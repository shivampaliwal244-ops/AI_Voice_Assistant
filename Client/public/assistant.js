(function () {


    // userData

    const script = document.currentScript;

    const userId = script?.dataset?.userId

    const theme = "dark"

    let assistantConfig = null


    // load CSS

    const link = document.createElement("link")

    link.rel = "stylesheet"

    link.href = "https://ai-voice-assistant-y7a8.onrender.com/assistant.css"

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
    />`;
    document.body.appendChild(button)




    // toggle popup

    let open = false

    button.onclick = () => {
        open = !open;
        popup.style.display = open ? "flex" : "none";
    }


    // load Assistant

    const loadAssistant = async () => {
        try {
            const res = await fetch(`https://ai-voice-assistant-server-backend.onrender.com/api/assistant/config/${userId}`)

            const data = await res.json()

            if (data) {
                assistantConfig = data.user
                applyConfig()
            }

        } catch (error) {
            console.log(
                "Assistant Load Error:",
                error
            );
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

    // Language detection function
    const detectLanguage = (text) => {
        // Check for Hindi characters (Devanagari script range: \u0900-\u097F)
        const hindiRegex = /[\u0900-\u097F]/;
        return hindiRegex.test(text) ? "hi-IN" : "en-US";
    };

    // Voice selection function
    const selectVoice = (lang) => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length === 0) return null;

        // For English, prefer female voices in specific order
        if (lang === "en-US" || lang === "en-GB") {
            const preferredVoices = [
                "Microsoft Zira",
                "Microsoft Jenny",
                "Google UK English Female"
            ];

            // Try preferred voices first
            for (const preferred of preferredVoices) {
                const voice = voices.find(v => v.name.includes(preferred));
                if (voice) return voice;
            }

            // Try any female English voice
            const femaleVoice = voices.find(v => 
                v.lang.startsWith("en") && 
                (v.name.includes("Female") || v.name.includes("female"))
            );
            if (femaleVoice) return femaleVoice;
        }

        // For Hindi, prefer Hindi voices
        if (lang === "hi-IN") {
            const hindiVoice = voices.find(v => v.lang.startsWith("hi"));
            if (hindiVoice) return hindiVoice;
        }

        // Fallback to first available voice
        return voices[0];
    };

    // text-speech

    const speak = (text) => {
        console.log("AI Response:", text);
        
        // Prevent overlapping speech
        if (isSpeaking) {
            console.log("Already speaking, skipping duplicate request");
            return;
        }

        // Cancel any existing speech
        window.speechSynthesis.cancel();

        // Wait 100ms before speaking to prevent "interrupted" errors
        setTimeout(() => {
            // Show AI response
            aiText.innerText = text;

            status.innerText = "AI Speaking...";

            // Detect language from the response text
            const detectedLang = detectLanguage(text);
            currentLang = detectedLang;

            const speech = new SpeechSynthesisUtterance(text);
            console.log("Creating utterance with language:", detectedLang);

            speech.lang = detectedLang;
            speech.rate = 1;
            speech.pitch = 1;
            speech.volume = 1;

            // Select appropriate voice
            const selectedVoice = selectVoice(detectedLang);
            if (selectedVoice) {
                speech.voice = selectedVoice;
                console.log("Selected voice:", selectedVoice.name);
            }

            // Set speaking state
            isSpeaking = true;

            // Voice end
            speech.onend = () => {
                console.log("Speech ended");
                isSpeaking = false;
                status.innerText = "Tap button to Speak";
                wave.style.opacity = "0";
            };

            speech.onstart = () => {
                console.log("Speech started");
            };

            speech.onerror = (e) => {
                console.error("Speech error", e);
                isSpeaking = false;
                status.innerText = "Tap button to Speak";
                wave.style.opacity = "0";
            };

            console.log("speechSynthesis.speaking", window.speechSynthesis.speaking);
            console.log("speechSynthesis.pending", window.speechSynthesis.pending);
            console.log("Calling speechSynthesis.speak()");

            // Start speaking
            window.speechSynthesis.speak(speech);
        }, 100);
    }


    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition


    if(SpeechRecognition){

        const recognition = new SpeechRecognition();

        recognition.lang = currentLang;

    recognition.continuous =
      false;

    recognition.interimResults =
      false;


      mic.onclick=()=>{
        wave.style.opacity =
        "1";

      status.innerText =
        "Listening...";

      userText.innerText =
        "";

      aiText.innerText =
        "";

      recognition.start();
      }


      recognition.onresult = (e)=>{
        const text = e.results[0][0].transcript

        userText.innerText = "You: " + text;

        // Detect language from user input and update currentLang
        currentLang = detectLanguage(text);

        recognition.stop();


        setTimeout( async () => {
            try {
                status.innerText = "Thinking...";
                

                const res = await fetch("https://ai-voice-assistant-server-backend.onrender.com/api/assistant/ask" , {
                    method:"POST",
                    credentials:"include",
                    headers:{
                        "Content-Type":
                      "application/json",
                    } ,
                    body:JSON.stringify({
                        message:text,
                        userId
                    })
                })

                const data = await res.json()
                console.log(data)

                if(data.success){

                    if(data.action === "navigate"){
                        speak(data.response)

                        setTimeout(()=>{
                            window.location.href = data.path

                        },1500)

                    }else{
                        speak(data.aiResponse)
                    }

                }else{
                    speak("Response Error please Check your plan")

                }



            } catch (error) {
                console.log(error)
                speak("AI Server Error")
                
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