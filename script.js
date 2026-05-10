// Mat7afi - AI Chatbot & UI Logic

window.loadMuseumArtifacts = (collectionId, museumName) => {
    window.location.href = `museum.html?id=${collectionId}&name=${encodeURIComponent(museumName)}`;
};

// Initialize Appwrite at the top level
let databases;
const databaseId = '69f699480010e2feea8a';

if (typeof Appwrite !== 'undefined') {
    const { Client, Databases } = Appwrite;
    const client = new Client();
    client
        .setEndpoint('https://appwrite.etihadalmdina.com/v1')
        .setProject('69f21c73000621939422');
    databases = new Databases(client);
}

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

    // SECURITY: API Keys are obfuscated to prevent basic scraping.
    // In a production environment, use a backend proxy to keep keys hidden.
    const _secKey = ['c2stcHJvai0xZ1BFRU1aQmtLcE9YYjRrVUI0aGtfX2F5UGVvd2RYZUFKczA2RjVjdXFyTUZxV0ZoWGVuRWdGX1ZLSzlhSmR1Q0JNSHdpbnNSX1QzQmxia0ZKTXRqYzlid0djWFNMb0xCel9yQ1Jsdks5dE5XUnBkdXAxQmtXOUZmV3FJLVJVS1dQbmNWSzZDd2JiMktSSnR5ODZ0bWVyd01yb0E='];
    const OPENAI_API_KEY = atob(_secKey[0]); 
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
    // 4. Appwrite Integration for Artifacts Exploration
    if (typeof Appwrite !== 'undefined' && databases) {
        window.initMuseumPage = async (collectionId, museumName) => {
        const artifactsGrid = document.getElementById('artifacts-grid');
        const searchInput = document.getElementById('artifact-search');
        if (!artifactsGrid) return;

        let allArtifacts = [];

        try {
            const response = await databases.listDocuments(databaseId, collectionId);
            allArtifacts = response.documents;

            const renderArtifacts = (list) => {
                if (list.length === 0) {
                    artifactsGrid.innerHTML = '<div class="col-12 text-center py-5"><h3 class="text-white-50">لم يتم العثور على نتائج تطابق بحثك</h3></div>';
                    return;
                }

                artifactsGrid.innerHTML = '';
                list.forEach(artifact => {
                    const bucketId = getBucketByType(collectionId);
                    const imageUrl = artifact.image_url || getAppwriteImageUrl(artifact.image, bucketId);
                    
                    const card = document.createElement('div');
                    card.className = 'col-lg-3 col-md-4 col-sm-6 mb-4';
                    card.innerHTML = `
                        <div class="artifact-card" onclick="location.href='artifact.html?id=${artifact.$id}&collection=${collectionId}&museum=${encodeURIComponent(museumName)}'" data-aos="fade-up">
                            <div class="artifact-card-img">
                                <img src="${imageUrl}" alt="${artifact['name-ar']}" loading="lazy">
                            </div>
                            <div class="artifact-card-body text-center p-3">
                                <h3 class="artifact-card-title" style="font-size: 1.1rem; color: var(--cream);">${artifact['name-ar']}</h3>
                            </div>
                        </div>
                    `;
                    artifactsGrid.appendChild(card);
                });
                // Refresh AOS to detect new elements
                setTimeout(() => {
                    if (window.AOS) {
                        AOS.refresh();
                        // Additional check: If elements are still invisible on mobile, force opacity
                        document.querySelectorAll('.artifact-card').forEach(el => {
                            if (window.getComputedStyle(el).opacity === "0") {
                                el.style.opacity = "1";
                                el.style.transform = "none";
                            }
                        });
                    }
                }, 500);
            };

            // Initial render
            renderArtifacts(allArtifacts);

            // Live Search Logic with Arabic Normalization
            if (searchInput) {
                const normalizeArabic = (text) => {
                    if (!text) return "";
                    return text.toString()
                        .replace(/[أإآا]/g, "ا")
                        .replace(/ى/g, "ي")
                        .replace(/ة/g, "ه")
                        .replace(/[\u064B-\u0652]/g, "") // Remove Tashkeel
                        .toLowerCase()
                        .trim();
                };

                searchInput.addEventListener('input', (e) => {
                    const query = normalizeArabic(e.target.value);
                    console.log('Searching for:', query);

                    const filtered = allArtifacts.filter(art => {
                        const nameAr = normalizeArabic(art['name-ar']);
                        const descAr = normalizeArabic(art['description-ar']);
                        const nameEn = (art['name-en'] || "").toLowerCase();
                        
                        return nameAr.includes(query) || 
                               descAr.includes(query) || 
                               nameEn.includes(query);
                    });
                    
                    renderArtifacts(filtered);
                });
            }

        } catch (error) {
            console.error('Error fetching artifacts:', error);
            artifactsGrid.innerHTML = `
                <div class="col-12 text-center py-5">
                    <h3>حدث خطأ أثناء تحميل البيانات.</h3>
                    <p class="text-white-50 mt-2">${error.message || 'يرجى التحقق من اتصالك بالإنترنت أو إعدادات الخادم.'}</p>
                </div>
            `;
        }
    };


    window.initArtifactPage = async (documentId, collectionId, museumName) => {
        const loader = document.getElementById('loader');
        const content = document.getElementById('artifact-content');
        
        try {
            const artifact = await databases.getDocument(databaseId, collectionId, documentId);
            const bucketId = getBucketByType(collectionId);
            
            // Set basic info
            document.getElementById('artifact-img').src = artifact.image_url || getAppwriteImageUrl(artifact.image, bucketId, 80);
            document.title = `${artifact['name-ar']} | Mat7afi`;
            document.getElementById('artifact-desc').innerText = artifact['description-ar'];

            const infoCard = document.getElementById('info-card');
            infoCard.innerHTML = '';

            // Dynamic fields based on museum type
            if (collectionId.includes('tourism')) {
                addInfoRow(infoCard, 'العصر', artifact['era-ar'], 'fa-history');
                addInfoRow(infoCard, 'المادة', artifact['material-ar'], 'fa-layer-group');
                addInfoRow(infoCard, 'الأبعاد', artifact['dimensions-ar'], 'fa-ruler-combined');
                addInfoRow(infoCard, 'الموقع', artifact['location-ar'], 'fa-map-marker-alt');
                
                if (artifact['audio-ar']) {
                    const audioSec = document.getElementById('audio-section');
                    audioSec.style.display = 'block';
                    document.getElementById('artifact-audio').src = getAppwriteAudioUrl(artifact['audio-ar']);
                }
            } else if (collectionId.includes('science')) {
                addInfoRow(infoCard, 'التصنيف', museumName, 'fa-microscope');
                if (artifact['name-ar']) addInfoRow(infoCard, 'الاسم', artifact['name-ar'], 'fa-tag');
            } else if (collectionId.includes('art')) {
                addInfoRow(infoCard, 'الفنان', artifact['author-ar'], 'fa-user-paint');
                addInfoRow(infoCard, 'الرقم التسلسلي', artifact['serial_number'], 'fa-qrcode');
                addInfoRow(infoCard, 'المقاس', artifact['size-ar'], 'fa-expand');
                addInfoRow(infoCard, 'النوع', artifact['type-ar'], 'fa-palette');
            }

            loader.style.display = 'none';
            content.style.display = 'block';
        } catch (error) {
            console.error('Error fetching artifact details:', error);
            loader.innerHTML = `
                <div class="text-center py-5">
                    <h3>حدث خطأ أثناء تحميل تفاصيل القطعة.</h3>
                    <p class="text-white-50 mt-2">${error.message || 'يرجى التحقق من اتصالك بالإنترنت.'}</p>
                </div>
            `;
        }
    };
    } else {
        console.warn('Appwrite SDK not loaded.');
    }

    function addInfoRow(container, label, value, icon) {
        if (!value) return;
        const row = document.createElement('div');
        row.className = 'mobile-info-row';
        row.innerHTML = `
            <div class="mobile-icon-circle"><i class="fas ${icon}"></i></div>
            <div class="mobile-info-label">${label}:</div>
            <div class="mobile-info-value">${value}</div>
        `;
        container.appendChild(row);
    }

    function getAppwriteAudioUrl(fileId) {
        return `https://appwrite.etihadalmdina.com/v1/storage/buckets/69f870c0000eb3969260/files/${fileId}/view?project=69f21c73000621939422`;
    }

    function getBucketByType(collectionId) {
        if (collectionId.includes('science') || collectionId.includes('art')) return '69f686e9002f917ec2a2';
        return '69f7d68c003821997d0d'; // Tourism
    }

    function getAppwriteImageUrl(fileId, bucketId, quality = 60) {
        if (!fileId) return 'assets/placeholder.png';
        return `https://appwrite.etihadalmdina.com/v1/storage/buckets/${bucketId}/files/${fileId}/preview?project=69f21c73000621939422&quality=${quality}`;
    }
});
