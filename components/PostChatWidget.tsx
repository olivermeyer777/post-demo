import React, { useEffect, useRef, useState } from "react";

type Role = "user" | "assistant" | "system";

interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
}

type Language = "de" | "fr" | "it" | "en";

const FLOW_PROMPTS: Record<string, Record<Language, string>> = {
  brief_versenden: {
    de: "Bitte starte direkt den Workflow „Brief versenden“ mit mir.",
    fr: "Merci de démarrer directement le flux « Envoyer une lettre » avec moi.",
    it: "Per favore avvia direttamente il flusso «Inviare una lettera» con me.",
    en: "Please start the “send letter” workflow with me directly.",
  },
};

const SYSTEM_INSTRUCTIONS: Record<Language, string> = {
  de: "Du bist ein Assistent der Schweizerischen Post. Antworte auf Deutsch und hilf bei postalischen Anliegen.",
  fr: "Tu es un assistant de La Poste Suisse. Réponds en français et aide pour les demandes postales.",
  it: "Sei un assistente della Posta Svizzera. Rispondi in italiano e aiuta con le richieste postali.",
  en: "You are an assistant of Swiss Post. Answer in English and help with postal requests.",
};

const STORAGE_KEY_MESSAGES = "post_chat_messages_v1";
const STORAGE_KEY_LANGUAGE = "post_chat_language_v1";

export const PostChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [language, setLanguage] = useState<Language>("de");
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);

  const [micActive, setMicActive] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [sttSupported, setSttSupported] = useState(true);
  const [ttsActive, setTtsActive] = useState(true);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  // 5) Memory laden
  useEffect(() => {
    try {
      const storedMessages = localStorage.getItem(STORAGE_KEY_MESSAGES);
      const storedLanguage = localStorage.getItem(
        STORAGE_KEY_LANGUAGE
      ) as Language | null;

      if (storedMessages) {
        const parsed: ChatMessage[] = JSON.parse(storedMessages);
        setMessages(parsed);
      } else {
        setMessages([
          {
            id: "system-initial",
            role: "system",
            content: SYSTEM_INSTRUCTIONS["de"],
            createdAt: Date.now(),
          },
        ]);
      }

      if (storedLanguage) {
        setLanguage(storedLanguage);
      }
    } catch (e) {
      console.error("Fehler beim Laden der Chat-Memory", e);
    }
  }, []);

  // 5) Memory speichern
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
    } catch (e) {
      console.error("Fehler beim Speichern der Chat-Memory", e);
    }
  }, [messages]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_LANGUAGE, language);
    } catch (e) {
      console.error("Fehler beim Speichern der Sprache", e);
    }
  }, [language]);

  // nach unten scrollen
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  // Mic Setup
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSttSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = languageMapToLocale(language);
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setInputValue((prev) => (prev ? prev + " " + transcript : transcript));
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event);
      setMicActive(false);
    };

    recognition.onend = () => {
      setMicActive(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, [language]);

  // TTS: letzte Assistant-Antwort vorlesen
  useEffect(() => {
    if (!ttsActive || messages.length === 0) return;
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    if (!last) return;

    const utterance = new SpeechSynthesisUtterance(last.content);
    utterance.lang = languageMapToLocale(language);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, [messages, ttsActive, language]);

  function languageMapToLocale(lang: Language): string {
    switch (lang) {
      case "de":
        return "de-CH";
      case "fr":
        return "fr-CH";
      case "it":
        return "it-CH";
      case "en":
        return "en-US";
      default:
        return "de-CH";
    }
  }

  // Nachricht senden
  const handleSend = async (text?: string) => {
    const trimmed = (text ?? inputValue).trim();
    if (!trimmed) return;

    setIsSending(true);
    setInputValue("");

    const newUserMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      content: trimmed,
      createdAt: Date.now(),
    };

    setMessages((prev) => [...prev, newUserMessage]);

    try {
      // TODO: HIER deinen bestehenden ChatKit-Aufruf einfügen
      // Aktuell nur Demo:
      const assistantText = await mockAssistantResponse(trimmed, language);

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: "assistant",
        content: assistantText,
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (e) {
      console.error("Fehler beim Senden an Backend", e);
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-error`,
        role: "assistant",
        content:
          "Leider ist gerade ein Fehler aufgetreten. Bitte versuche es später erneut.",
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
    }
  };

  const handleFlowClick = (flowId: keyof typeof FLOW_PROMPTS) => {
    const prompt = FLOW_PROMPTS[flowId][language];
    handleSend(prompt);
  };

  const toggleMic = () => {
    if (!recognitionRef.current) {
      setSttSupported(false);
      return;
    }
    if (micActive) {
      recognitionRef.current.stop();
      setMicActive(false);
    } else {
      recognitionRef.current.lang = languageMapToLocale(language);
      recognitionRef.current.start();
      setMicActive(true);
    }
  };

  return (
    <>
      {!isOpen && (
        <button
          className="post-chat-toggle-btn"
          onClick={() => setIsOpen(true)}
          aria-label="Chat öffnen"
        >
          💬
        </button>
      )}

      {isOpen && (
        <div className="post-chat-overlay">
          <header className="post-chat-header">
            <div className="post-chat-header-left">
              <div className="post-logo-badge">P</div>
              <div className="post-chat-titles">
                <div className="post-chat-title">Post Assistent</div>
                <div className="post-chat-subtitle">
                  Hilfe zu Briefen, Paketen & Filialen
                </div>
              </div>
            </div>

            <div className="post-chat-header-right">
              <select
                className="post-chat-language-select"
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
              >
                <option value="de">DE</option>
                <option value="fr">FR</option>
                <option value="it">IT</option>
                <option value="en">EN</option>
              </select>

              <button
                className={`post-chat-mic-btn ${
                  !sttSupported ? "post-chat-mic-unsupported" : ""
                } ${micActive ? "post-chat-mic-on" : "post-chat-mic-off"}`}
                onClick={toggleMic}
                disabled={!sttSupported}
                title={
                  !sttSupported
                    ? "Spracherkennung wird von diesem Browser nicht unterstützt."
                    : micActive
                    ? "Sprachaufnahme stoppen"
                    : "Sprachaufnahme starten"
                }
              >
                {micActive ? "🎙" : "🎙̶"}
              </button>

              <button
                className={`post-chat-tts-btn ${ttsActive ? "on" : "off"}`}
                onClick={() => setTtsActive((v) => !v)}
                title={
                  ttsActive ? "Vorlesen deaktivieren" : "Vorlesen aktivieren"
                }
              >
                🔊
              </button>

              <button
                className="post-chat-close-btn"
                onClick={() => setIsOpen(false)}
                aria-label="Chat ausblenden"
              >
                ✕
              </button>
            </div>
          </header>

          <div className="post-chat-flow-bar">
            <button
              className="post-chat-flow-btn"
              onClick={() => handleFlowClick("brief_versenden")}
            >
              ✉️ Brief versenden
            </button>
          </div>

          <div className="post-chat-messages" ref={scrollRef}>
            {messages.map((m) => (
              <div
                key={m.id}
                className={`post-chat-message post-chat-message-${m.role}`}
              >
                {m.role === "assistant" && (
                  <div className="post-chat-avatar">P</div>
                )}
                <div className="post-chat-bubble">{m.content}</div>
              </div>
            ))}
          </div>

          <div className="post-chat-input-row">
            <input
              className="post-chat-input"
              placeholder={
                language === "de"
                  ? "Nachricht an die Post eingeben…"
                  : language === "fr"
                  ? "Saisir un message à La Poste…"
                  : language === "it"
                  ? "Inserisci un messaggio alla Posta…"
                  : "Type a message to Swiss Post…"
              }
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <button
              className="post-chat-send-btn"
              onClick={() => handleSend()}
              disabled={isSending || !inputValue.trim()}
            >
              {isSending ? "…" : "➤"}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

async function mockAssistantResponse(
  text: string,
  language: Language
): Promise<string> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const base =
        language === "de"
          ? "Dies ist eine Demo-Antwort. Hier würdest du die echte ChatKit-Antwort sehen."
          : language === "fr"
          ? "Ceci est une réponse de démonstration. Ici tu verrais la vraie réponse de ChatKit."
          : language === "it"
          ? "Questa è una risposta di demo. Qui vedresti la vera risposta di ChatKit."
          : "This is a demo answer. Here you would see the real ChatKit answer.";

      resolve(`${base}\n\nDu hast geschrieben: "${text}"`);
    }, 600);
  });
}
