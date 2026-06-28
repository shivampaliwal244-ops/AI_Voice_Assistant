import User from "../Models/user.model.js"
import { generateGeminiResponse } from "../Configs/gemini.js"

export const askAssistant = async (req, res) => {
    try {
        const { message, userLanguage } = req.body;
        
        if (!message) {
            return res.status(400).json({ 
                success: false, 
                message: "Message is required" 
            });
        }

        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: "User not found" 
            });
        }

        if (!user.geminiApiKey) {
            return res.status(400).json({ 
                success: false, 
                errorType: "missing_api_key",
                message: "Gemini API key not configured. Please set up your assistant first." 
            });
        }

        if (user.geminiStatus === "invalid" || user.geminiStatus === "forbidden" || user.geminiStatus === "not_found") {
            return res.status(400).json({ 
                success: false, 
                errorType: "invalid_api_key",
                message: "Your Gemini API key is invalid. Please update it in your settings." 
            });
        }

        // Construct prompt with user's business context
        const prompt = `You are ${user.assistantName || "Shifra AI"}, an AI assistant for ${user.businessName || "this website"}.
Business Type: ${user.businessType || "General"}
Business Description: ${user.businessDescription || "A website"}
Tone: ${user.tone || "Professional and helpful"}

Available Pages: ${user.pages && user.pages.length > 0 ? user.pages.map(p => p.name).join(", ") : "Home"}

User Question: ${message}

Please provide a helpful, accurate response. If the user is asking about navigation to a specific page, include the page name in your response.`;

        const geminiResponse = await generateGeminiResponse({
            prompt,
            apikey: user.geminiApiKey,
            user
        });

        if (!geminiResponse.success) {
            return res.status(geminiResponse.status || 500).json({
                success: false,
                errorType: geminiResponse.errorType,
                message: geminiResponse.message
            });
        }

        // Check if response contains navigation instruction
        const aiResponse = geminiResponse.text;
        let action = "normal";
        let path = null;
        let responseText = aiResponse;

        // Check for navigation patterns
        if (user.pages && user.pages.length > 0) {
            for (const page of user.pages) {
                if (aiResponse.toLowerCase().includes(page.name.toLowerCase()) && 
                    (aiResponse.toLowerCase().includes("navigate") || 
                     aiResponse.toLowerCase().includes("go to") ||
                     aiResponse.toLowerCase().includes("take you to"))) {
                    action = "navigate";
                    path = page.path;
                    responseText = `I'll take you to ${page.name}.`;
                    break;
                }
            }
        }

        return res.status(200).json({
            success: true,
            action,
            response: responseText,
            aiResponse,
            path
        });

    } catch (error) {
        console.error("askAssistant error:", error);
        return res.status(500).json({ 
            success: false, 
            message: `An error occurred: ${error.message}` 
        });
    }
};

export const getAssistantConfig = async (req, res) => {
    try {
        const { userId } = req.params;
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: "User not found" 
            });
        }

        return res.status(200).json({
            success: true,
            user: {
                assistantName: user.assistantName,
                businessName: user.businessName,
                businessType: user.businessType,
                businessDescription: user.businessDescription,
                tone: user.tone,
                theme: user.theme,
                isSetupComplete: user.isSetupComplete
            }
        });

    } catch (error) {
        console.error("getAssistantConfig error:", error);
        return res.status(500).json({ 
            success: false, 
            message: `An error occurred: ${error.message}` 
        });
    }
};