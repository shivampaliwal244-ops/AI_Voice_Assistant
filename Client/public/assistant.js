(function () {

    // Prevent multiple initialization
    if (window.__shifraAssistantInitialized) {
        console.warn("Shifra Assistant already initialized. Skipping duplicate initialization.");
        return;
    }
    window.__shifraAssistantInitialized = true;

    // userData

    const script = document.currentScript;

    const userId = script?.dataset?.userId

    const theme = "dark"

    let assistantConfig = null

    // Retry helper function - only retry on network failures
    const retryFetch = async (url, options = {}, retries = 3, delay = 1000) => {
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(url, options);
                if (response.ok) return response;
                // Don't retry on client errors (4xx) - these are not retryable
                if (response.status >= 400 && response.status < 500) {
                    throw new Error(`Request failed with status ${response.status}`);
                }
                // Retry on server errors (5xx) and network failures
                if (i === retries - 1) throw new Error(`Request failed with status ${response.status}`);
            } catch (error) {
                // Don't retry if it's a non-network error
                if (error.message.includes('Request failed with status')) {
                    throw error;
                }
                if (i === retries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
            }
        }
    };

    // load CSS with error handling

    const link = document.createElement("link")

    link.rel = "stylesheet"

    link.href = "https://ai-voice-assistant-y7a8.onrender.com/assistant.css"

    link.onerror = () => {
        console.error("Failed to load assistant CSS");
    };

    link.onload = () => {
        console.log("Assistant CSS loaded successfully");
    };

    document.head.appendChild(link)


    // Create PopUp

    const popup = document.createElement("div")

    popup.className = `shifra-popup theme-${theme}`

    popup.innerHTML = `
    <div class="shifra-overlay"></div>

    <div class="shifra-content">

       <div class="shifra-top">
            <div class="shifra-orb-wrap">

                <div class="shifra-orb-glow"></div>

                <div class="shifra-orb"></div>

            </div>

            <h2 class="shifra-title">
                Hello! I'm Shifra AI
            </h2>

            <p class="shifra-sub">
                Your smart voice assistant.
                <br />
                Ask anything about your website.
            </p>


            <div class="shifra-status">
                Tap button to Speak
            </div>

            <div class="shifra-wave">
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
            </div>

            <!-- User Text -->
            <div class="shifra-user-text">
            </div>

            <!-- AI Text -->
            <div class="shifra-ai-text">
            </div>
  
        </div>


        <div class="shifra-bottom">
            
            <button class="shifra-mic">

               <img 
               src="https://ai-voice-assistant-y7a8.onrender.com/mic.svg"
               alt="mic"
               class="shifra-mic-icon"/>
            </button>
        </div>
    </div>
    
    `;

    document.body.appendChild(popup);

    // floating Button

    const button = document.createElement("button")

    button.className = `shifra-btn theme-${theme}`

    button.innerHTML = `
    <img 
    src="https://ai-voice-assistant-y7a8.onrender.com/logo.png"
    alt="logo"
    class="shifra-logo"
    onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><circle cx=%2250%22 cy=%2250%22 r=%2240%22 fill=%22%237c3aed%22/></svg>'"
    />`;
    document.body.appendChild(button)




    // toggle popup

    let open = false

    button.onclick = () => {
        open = !open;
        if (open) {
            popup.style.display = "flex";
            popup.style.visibility = "visible";
            popup.style.opacity = "1";
        } else {
            popup.style.display = "none";
            popup.style.visibility = "hidden";
            popup.style.opacity = "0";
        }
    }


    // load Assistant

    const loadAssistant = async () => {
        try {
            const res = await retryFetch(`https://ai-voice-assistant-server-backend.onrender.com/api/assistant/config/${userId}`, {}, 3, 1000);
            const data = await res.json();

            if (data) {
                assistantConfig = data.user;
                applyConfig();
            }

        } catch (error) {
            console.error("Assistant Load Error:", error);
            const status = popup.querySelector(".shifra-status");
            if (status) {
                status.innerText = "Server unavailable. Please refresh.";
                status.style.color = "#ef4444";
            }
        }
    }


    const applyConfig = () => {
        if (!assistantConfig) return;

        popup.className = `shifra-popup theme-${assistantConfig.theme}`

        button.className = `shifra-btn theme-${assistantConfig.theme}`

        const title = popup.querySelector(".shifra-title")

        title.innerHTML = `Hello! I'm ${assistantConfig.assistantName}`;

        const subTitle = popup.querySelector(".shifra-sub")
        subTitle.innerHTML = `
    Welcome to
    ${assistantConfig.businessName}.
    <br />
    Ask anything about your website.
  `;


    }

    loadAssistant()


    // Element


    const status =
        popup.querySelector(
            ".shifra-status"
        );

    const wave =
        popup.querySelector(
            ".shifra-wave"
        );

    const userText =
        popup.querySelector(
            ".shifra-user-text"
        );

    const aiText =
        popup.querySelector(
            ".shifra-ai-text"
        );

    const mic =
        popup.querySelector(
            ".shifra-mic"
        );

    // Speech state management
    let isSpeaking = false;
    let currentLang = "en-US"; // Default to English
    let voicesLoaded = false;
    let voiceLoadAttempts = 0;
    const MAX_VOICE_LOAD_ATTEMPTS = 10;
    let userInteracted = false;

    // Mark user interaction when button is clicked
    button.addEventListener('click', () => {
        userInteracted = true;
        console.log("User interaction detected on button");
    });

    // Check if speech synthesis is supported
    if (!('speechSynthesis' in window)) {
        console.error("Speech synthesis not supported in this browser");
        const status = popup.querySelector(".shifra-status");
        if (status) {
            status.innerText = "Speech not supported";
            status.style.color = "#ef4444";
        }
    }

    // Load voices
    const loadVoices = () => {
        try {
            const voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
                voicesLoaded = true;
                console.log("Voices loaded:", voices.length);
                console.log("Available voices:", voices.map(v => v.name));
            } else {
                voiceLoadAttempts++;
                console.log("No voices yet, attempt", voiceLoadAttempts);
                // Force proceed after 3 attempts instead of 10
                if (voiceLoadAttempts >= 3) {
                    console.warn("Voice load taking too long, proceeding with default");
                    voicesLoaded = true;
                }
            }
        } catch (error) {
            console.error("Error loading voices:", error);
            voicesLoaded = true; // Force proceed anyway
        }
    };

    // Load voices immediately and also on voiceschanged event
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    // Language detection - REMOVED
    // Always use English-only as per requirements
    // No Hindi detection, no Roman Hindi conversion
    const detectLanguage = (text) => {
        return "en-US"; // Always English
    };

    // Voice selection function - English only
    const selectVoice = (lang) => {
        const voices = window.speechSynthesis.getVoices();
        console.log("Available voices:", voices.length);
        
        if (!voices || voices.length === 0) {
            console.warn("No voices available, returning null");
            return null;
        }

        // Always prefer English voices only
        const preferredVoices = [
            "Microsoft Zira",
            "Microsoft Jenny",
            "Google US English",
            "Google UK English Female",
            "Microsoft Aria",
            "Microsoft David"
        ];

        // Try preferred voices first
        for (const preferred of preferredVoices) {
            const voice = voices.find(v => v.name.includes(preferred));
            if (voice) {
                console.log("Found preferred voice:", voice.name);
                return voice;
            }
        }

        // Try any English voice (exclude Indian English to avoid Hindi-accented voices)
        const englishVoice = voices.find(v => 
            v.lang.startsWith("en") && 
            !v.lang.includes("IN") && // Exclude English India
            !v.name.includes("Heera") && // Exclude Microsoft Heera
            !v.name.includes("India")
        );
        if (englishVoice) {
            console.log("Found English voice (non-India):", englishVoice.name);
            return englishVoice;
        }
        
        // Fallback to any English voice including India if no other option
        const anyEnglishVoice = voices.find(v => v.lang.startsWith("en"));
        if (anyEnglishVoice) {
            console.log("Fallback to any English voice:", anyEnglishVoice.name);
            return anyEnglishVoice;
        }

        // Final fallback to first available voice
        console.log("Using fallback voice:", voices[0].name);
        return voices[0];
    };

    // text-speech

    const speak = (text) => {
        console.log("=== SPEAK FUNCTION CALLED ===");
        console.log("AI Response:", text);
        console.log("Voices loaded:", voicesLoaded);
        console.log("User interacted:", userInteracted);
        
        if (!text || text.trim() === "") {
            console.warn("Empty text provided to speak function");
            return;
        }
        
        // Check for user interaction (browser autoplay policy)
        if (!userInteracted) {
            console.warn("No user interaction yet, speech may be blocked by browser");
            // Try anyway, but log warning
        }
        
        // Prevent overlapping speech
        if (isSpeaking) {
            console.log("Already speaking, skipping duplicate request");
            return;
        }

        // Cancel any existing speech
        window.speechSynthesis.cancel();
        console.log("Cancelled existing speech");

        // Don't wait for voices if we've tried too many times - proceed with default
        if (!voicesLoaded && voiceLoadAttempts >= MAX_VOICE_LOAD_ATTEMPTS) {
            console.log("Max voice load attempts reached, proceeding with default voice");
            voicesLoaded = true;
        }

        // Wait for voices to load if not loaded yet
        if (!voicesLoaded) {
            console.log("Waiting for voices to load...");
            setTimeout(() => speak(text), 500);
            return;
        }

        // Wait 100ms before speaking to prevent "interrupted" errors
        setTimeout(() => {
            // Show AI response
            aiText.innerText = text;

            status.innerText = "AI Speaking...";

            // Force English-only speech
            const forcedLang = "en-US";
            currentLang = forcedLang;
            console.log("Forced speech language: en-US");

            const speech = new SpeechSynthesisUtterance(text);
            console.log("Creating utterance with language: en-US");

            speech.lang = "en-US"; // Force English US
            speech.rate = 1;
            speech.pitch = 1;
            speech.volume = 1;

            // Select appropriate voice (always English)
            const selectedVoice = selectVoice("en-US");
            if (selectedVoice) {
                speech.voice = selectedVoice;
                console.log("Selected voice:", selectedVoice.name);
            } else {
                console.warn("No voice selected, using default");
            }

            // Set speaking state
            isSpeaking = true;

            // Voice end
            speech.onend = () => {
                console.log("=== SPEECH ENDED ===");
                isSpeaking = false;
                status.innerText = "Tap button to Speak";
                wave.style.opacity = "0";
            };

            speech.onstart = () => {
                console.log("=== SPEECH STARTED ===");
            };

            speech.onerror = (e) => {
                console.error("=== SPEECH ERROR ===");
                console.error("Speech error", e);
                console.error("Error details:", e.error);
                isSpeaking = false;
                status.innerText = "Tap button to Speak";
                wave.style.opacity = "0";
            };

            console.log("speechSynthesis.speaking", window.speechSynthesis.speaking);
            console.log("speechSynthesis.pending", window.speechSynthesis.pending);
            console.log("Calling speechSynthesis.speak()");

            // Resume speech synthesis if it was paused
            try {
                window.speechSynthesis.resume();
            } catch (e) {
                console.error("Error resuming speech:", e);
            }

            // Start speaking
            try {
                window.speechSynthesis.speak(speech);
                console.log("speechSynthesis.speak() called successfully");
                
                // Check if speech actually started after a delay
                setTimeout(() => {
                    if (!window.speechSynthesis.speaking && isSpeaking) {
                        console.error("Speech failed to start - may be blocked by browser");
                        status.innerText = "Audio blocked - Check browser settings";
                        isSpeaking = false;
                        wave.style.opacity = "0";
                    }
                }, 500);
            } catch (e) {
                console.error("Error calling speak():", e);
                isSpeaking = false;
                status.innerText = "Audio error - Check browser";
                wave.style.opacity = "0";
            }
            
            // Force resume after a short delay to ensure it starts
            setTimeout(() => {
                if (window.speechSynthesis.paused) {
                    console.log("Speech was paused, resuming...");
                    window.speechSynthesis.resume();
                }
            }, 100);
        }, 100);
    }


    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition


    if(SpeechRecognition){

        const recognition = new SpeechRecognition();

        // Force English-India recognition (recognizes English well)
        // Changed from hi-IN to en-IN as per requirements
        recognition.lang = "en-IN";
        recognition.continuous = false;
        recognition.interimResults = false;


        mic.onclick = () => {
            userInteracted = true;
            console.log("User interaction detected on mic click");

            if (recognition && wave.style.opacity === "1") {
                console.log("Already listening, ignoring duplicate click");
                return;
            }

            wave.style.opacity = "1";
            status.innerText = "Listening...";
            userText.innerText = "";
            aiText.innerText = "";

            recognition.start();
        }


        recognition.onresult = (e) => {
            const transcript = e.results[0][0].transcript;
            console.log("Raw transcript:", transcript);

            // Always use English - no language detection
            currentLang = "en-US";
            console.log("Forced language: en-US");

            // Display transcript as-is
            userText.innerText = "You: " + transcript;

            recognition.stop();


        setTimeout( async () => {
            // Prevent multiple concurrent requests
            if (status.innerText === "Thinking...") {
                console.log("Request already in progress, ignoring duplicate");
                return;
            }
            
            try {
                status.innerText = "Thinking...";
                

                const res = await retryFetch("https://ai-voice-assistant-server-backend.onrender.com/api/assistant/ask", {
                    method:"POST",
                    credentials:"include",
                    headers:{
                        "Content-Type":
                      "application/json",
                    } ,
                    body:JSON.stringify({
                        message: transcript,
                        userId,
                        userLanguage: currentLang  // "hi-IN" or "en-US"
                    })
                }, 3, 1000)

                const data = await res.json()
                console.log(data)

                if(data.success){

                    if(data.action === "navigate"){
                        console.log("Navigation action, speaking response");
                        console.log("Response text:", data.response);
                        speak(data.response)

                        setTimeout(()=>{
                            window.location.href = data.path
                        },1500)

                    }else{
                        console.log("Normal response, speaking AI response");
                        console.log("AI Response text:", data.aiResponse);
                        if (data.aiResponse && data.aiResponse.trim() !== "") {
                            speak(data.aiResponse)
                        } else {
                            console.warn("Empty AI response, not speaking");
                            status.innerText = "No response received";
                            status.style.color = "#ef4444";
                        }
                    }

                }else{
                    console.log("API returned error:", data);
                    // Use backend error message
                    const errorMessage = data.message || "An error occurred";
                    status.innerText = errorMessage;
                    status.style.color = "#ef4444";
                    wave.style.opacity = "0";
                    
                    // Speak the error message
                    if (data.errorType === "quota_exceeded") {
                        speak("The AI service has reached its daily usage limit.");
                    } else if (data.errorType === "service_unavailable" || data.errorType === "circuit_breaker_open") {
                        speak("Google AI is currently busy. Please try again shortly.");
                    } else if (data.errorType === "timeout") {
                        speak("The request timed out. Please try again.");
                    } else if (data.errorType === "database_unavailable") {
                        speak("Database error. Please try again.");
                    } else {
                        speak(errorMessage);
                    }
                }



            } catch (error) {
                console.error("API Error:", error);
                console.error("Error details:", error.message);
                
                // Check if it's a network error
                if (error.message.includes('fetch') || error.message.includes('network')) {
                    status.innerText = "Network error. Please check your connection.";
                    status.style.color = "#ef4444";
                    wave.style.opacity = "0";
                    speak("Network error. Please check your connection.");
                } else {
                    status.innerText = "An error occurred. Please try again.";
                    status.style.color = "#ef4444";
                    wave.style.opacity = "0";
                    speak("An error occurred. Please try again.");
                }
            }
        },600)
      };

      recognition.onerror = ()=>{
        status.innerText =
          "Tap button to Speak";

        wave.style.opacity =
          "0";
      }


    }
    else{
        status.innerText =
      "Speech Recognition not supported";
    }


})();