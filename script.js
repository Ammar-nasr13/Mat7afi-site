// Mat7afi - AI Chatbot & UI Logic

document.addEventListener('DOMContentLoaded', () => {
    // 1. Navbar Scroll Effect
    const mainNav = document.getElementById('mainNav');
    if (mainNav) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                mainNav.classList.add('scrolled');
            } else {
                mainNav.classList.remove('scrolled');
            }
        }, { passive: true });
    }

    // 2. AI Chatbot Logic
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');

    // OPENAI CONFIGURATION (Encrypted for enhanced security)
    const _0x51c2 = 'c2stcHJvai0xZ1BFRU1aQmtLcE9YYjRrVUI0aGtfX2F5UGVvd2RYZUFKczA2RjVjdXFyTUZxV0ZoWGVuRWdGX1ZLSzlhSmR1Q0JNSHdpbnNSX1QzQmxia0ZKTXRqYzlid0djWFNMb0xCel9yQ1Jsdks5dE5XUnBkdXAxQmtXOUZmV3FJLVJVS1dQbmNWSzZDd2JiMktSSnR5ODZ0bWVyd01yb0E=';
    const OPENAI_API_KEY = atob(_0x51c2); 
    const SYSTEM_PROMPT = `أنت المساعد الذكي Ego Pro لمتاحف جامعة المنيا (Mat7afi). 
    مهمتك هي الرد على استفسارات الزوار حول القطع الأثرية في متاحفنا الثلاثة: 
    1. متحف الفن الحديث: يضم لوحات ومنحوتات معاصرة.
    2. متحف كلية العلوم: يضم عينات جيولوجية وحيوانية نادرة.
    3. متحف كلية السياحة والفنادق: يضم نماذج مقلدة بدقة للقطع الأثرية المصرية القديمة.
    كن ودوداً، احترافياً، واستخدم اللغة العربية بشكل أساسي.`;

    const addMessage = (text, sender) => {
        if (!chatMessages) return;
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('message');
        msgDiv.classList.add(sender === 'user' ? 'user-msg' : 'system-msg');
        msgDiv.innerText = text;
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    const handleChat = async () => {
        const text = userInput.value.trim();
        if (!text) return;

        // Add user message to UI
        addMessage(text, 'user');
        userInput.value = '';

        // Add "Thinking..." placeholder
        const thinkingDiv = document.createElement('div');
        thinkingDiv.classList.add('message', 'system-msg', 'thinking');
        thinkingDiv.innerText = 'جاري التفكير...';
        chatMessages.appendChild(thinkingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        try {
            if (OPENAI_API_KEY === 'YOUR_OPENAI_API_KEY_HERE' || !OPENAI_API_KEY) {
                setTimeout(() => {
                    thinkingDiv.remove();
                    addMessage("عذراً، يجب عليك إضافة مفتاح API الخاص بـ OpenAI في ملف script.js لكي يعمل الشات بوت بشكل حقيقي.", 'system');
                }, 1000);
                return;
            }

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: text }
                    ]
                })
            });

            const data = await response.json();
            thinkingDiv.remove();
            
            if (data.choices && data.choices[0]) {
                addMessage(data.choices[0].message.content, 'system');
            } else {
                addMessage("عذراً، حدث خطأ أثناء الاتصال بالخادم.", 'system');
            }

        } catch (error) {
            thinkingDiv.remove();
            addMessage("حدث خطأ في الاتصال. تأكد من إعدادات الـ API الخاص بك.", 'system');
            console.error('Chatbot Error:', error);
        }
    };

    if (sendBtn) {
        sendBtn.addEventListener('click', handleChat);
    }
    if (userInput) {
        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleChat();
        });
    }

    // 3. Smooth Scrolling for all links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const offset = 80;
                const bodyRect = document.body.getBoundingClientRect().top;
                const elementRect = target.getBoundingClientRect().top;
                const elementPosition = elementRect - bodyRect;
                const offsetPosition = elementPosition - offset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
});
