const Gemini_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

// Circuit breaker state
let circuitBreakerOpen = false;
let circuitBreakerOpenTime = null;
const CIRCUIT_BREAKER_COOLDOWN = 30000; // 30 seconds

// Check if circuit breaker is open
const isCircuitBreakerOpen = () => {
  if (!circuitBreakerOpen) return false;
  const timeSinceOpen = Date.now() - circuitBreakerOpenTime;
  if (timeSinceOpen > CIRCUIT_BREAKER_COOLDOWN) {
    circuitBreakerOpen = false;
    circuitBreakerOpenTime = null;
    console.log("Circuit breaker reset after cooldown");
    return false;
  }
  return true;
};

// Open circuit breaker
const openCircuitBreaker = () => {
  circuitBreakerOpen = true;
  circuitBreakerOpenTime = Date.now();
  console.log("Circuit breaker opened due to repeated 503 errors");
};

// Check if status code is retryable
const isRetryableStatus = (status) => {
  return [429, 500, 502, 503, 504].includes(status);
};

// Retry with exponential backoff
const retryWithBackoff = async (fn, maxRetries = 3) => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt === maxRetries - 1;
      
      // Check if error is retryable
      const isRetryable = 
        error.name === 'AbortError' ||
        error.message?.includes('timeout') ||
        error.status && isRetryableStatus(error.status);
      
      if (!isRetryable || isLastAttempt) {
        throw error;
      }
      
      const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

export const generateGeminiResponse = async ({
    prompt,
    apikey,
    user
}) => {
    const startTime = Date.now();
    let retryCount = 0;
    
    try {
        if (!apikey) {
            return {
                success: false,
                errorType: "missing_api_key",
                status: 400,
                retryable: false,
                message: "Gemini API key missing"
            };
        }

        // Check circuit breaker
        if (isCircuitBreakerOpen()) {
            return {
                success: false,
                errorType: "circuit_breaker_open",
                status: 503,
                retryable: false,
                message: "Google AI is temporarily busy. Please try again shortly."
            };
        }

        const result = await retryWithBackoff(async () => {
            retryCount++;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30000);

            const response = await fetch(`${Gemini_URL}?key=${apikey}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: prompt
                                }
                            ]
                        }
                    ]
                }),
                signal: controller.signal
            });

            clearTimeout(timeout);

            if (!response.ok) {
                let errorMessage = `Gemini API error: ${response.status}`;
                
                try {
                    const errorText = await response.text();
                    errorMessage = errorText || errorMessage;
                } catch (e) {
                    // If we can't read error text, use status
                }

                // Attach status to error for retry logic
                const error = new Error(errorMessage);
                error.status = response.status;
                
                // Update user status based on error
                if (response.status === 400 || response.status === 401) {
                    user.geminiStatus = "invalid";
                    try {
                        await user.save();
                    } catch (saveError) {
                        console.error("Failed to save geminiStatus invalid:", saveError.message);
                    }
                }

                if (response.status === 429) {
                    user.geminiStatus = "quota_exceeded";
                    try {
                        await user.save();
                    } catch (saveError) {
                        console.error("Failed to save geminiStatus quota_exceeded:", saveError.message);
                    }
                }

                if (response.status === 403) {
                    user.geminiStatus = "forbidden";
                    try {
                        await user.save();
                    } catch (saveError) {
                        console.error("Failed to save geminiStatus forbidden:", saveError.message);
                    }
                }

                if (response.status === 404) {
                    user.geminiStatus = "not_found";
                    try {
                        await user.save();
                    } catch (saveError) {
                        console.error("Failed to save geminiStatus not_found:", saveError.message);
                    }
                }

                if (response.status === 503) {
                    user.geminiStatus = "server_error";
                    try {
                        await user.save();
                    } catch (saveError) {
                        console.error("Failed to save geminiStatus server_error:", saveError.message);
                    }
                    // Open circuit breaker on 503
                    openCircuitBreaker();
                }

                if (response.status === 500 || response.status === 502) {
                    user.geminiStatus = "server_error";
                    try {
                        await user.save();
                    } catch (saveError) {
                        console.error("Failed to save geminiStatus server_error:", saveError.message);
                    }
                }

                throw error;
            }

            return response;
        }, 3);

        const response = result;

        // Update user status on success
        user.geminiStatus = "active";
        try {
            await user.save();
        } catch (saveError) {
            console.error("Failed to save geminiStatus active:", saveError.message);
            // Don't throw - continue with response
        }

        let data;
        try {
            data = await response.json();
        } catch (jsonError) {
            return {
                success: false,
                errorType: "json_parse_error",
                status: 502,
                retryable: true,
                message: `Failed to parse Gemini response as JSON: ${jsonError.message}`
            };
        }
        
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            return {
                success: false,
                errorType: "invalid_response",
                status: 502,
                retryable: true,
                message: "No text returned from Gemini - response structure invalid"
            };
        }

        const responseTime = Date.now() - startTime;
        console.log(`Gemini request successful - Response time: ${responseTime}ms, Retries: ${retryCount}`);

        return {
            success: true,
            text: text.trim(),
            responseTime,
            retryCount
        };
    } catch (error) {
        const responseTime = Date.now() - startTime;
        console.error(`Gemini request failed - Response time: ${responseTime}ms, Retries: ${retryCount}, Error: ${error.message}`);
        
        if (error.name === 'AbortError') {
            return {
                success: false,
                errorType: "timeout",
                status: 408,
                retryable: true,
                message: "The request timed out after 30 seconds"
            };
        }
        
        // Return structured error based on status
        if (error.status === 429) {
            return {
                success: false,
                errorType: "quota_exceeded",
                status: 429,
                retryable: false,
                message: "Your Gemini API quota has been exhausted."
            };
        }
        
        if (error.status === 503) {
            return {
                success: false,
                errorType: "service_unavailable",
                status: 503,
                retryable: true,
                message: "Google AI is currently experiencing high demand. Please try again shortly."
            };
        }
        
        if (error.status === 500 || error.status === 502) {
            return {
                success: false,
                errorType: "server_error",
                status: error.status,
                retryable: true,
                message: `Google AI server error: ${error.message}`
            };
        }
        
        if (error.status === 400 || error.status === 401 || error.status === 403 || error.status === 404) {
            return {
                success: false,
                errorType: "client_error",
                status: error.status,
                retryable: false,
                message: error.message
            };
        }
        
        // Generic error
        return {
            success: false,
            errorType: "unknown_error",
            status: 500,
            retryable: false,
            message: error.message || "Unknown error occurred"
        };
    }
}