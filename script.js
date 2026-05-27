// Mat7afi - AI Chatbot & UI Logic

window.loadMuseumArtifacts = (collectionId, museumName) => {
    window.location.href =
        `museum.html?id=${collectionId}&name=${encodeURIComponent(museumName)}`;
};

// Initialize Appwrite Configuration
const AppwriteConfig = {
    endpoint: 'https://appwrite.etihadalmdina.com/v1',
    projectId: '69f21c73000621939422',
    databaseId: '69f699480010e2feea8a',

    collections: {
        tourism: 'tourism_artifacts',
        science: 'science_atifacts',
        art: 'art_atifacts',
        activation: 'activation_codes'
    },

    buckets: {
        tourism: '69f7d68c003821997d0d',
        artifacts: '69f686e9002f917ec2a2',
        audio: '69f870c0000eb3969260',
        artImages: '69fdfa66002d1a9106f7',
        scienceImages: '69fdfa80002f0db83c67',
        arModels: '6a13cf370017d4ff7006'
    }
};

let databases;

// Initialize Appwrite
if (typeof Appwrite !== 'undefined') {

    const { Client, Databases } = Appwrite;

    const client = new Client();

    client
        .setEndpoint(AppwriteConfig.endpoint)
        .setProject(AppwriteConfig.projectId);

    databases = new Databases(client);
}

document.addEventListener('DOMContentLoaded', () => {

    // Navbar Scroll
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

    // Chatbot
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const artifactSearchInput = document.getElementById('artifact-search');

    let museumArtifactsCache = [];
    let currentMuseumCollection = '';
    let currentMuseumName = '';

    const GEMINI_API_KEY = 'AIzaSyCrTSLql-6iD0V4FhgKN3dTLnGJb9ln8eE';

    const SYSTEM_PROMPT = `أنت مساعد ذكي متخصص في متاحف جامعة المنيا. اسمك 'Ego Pro'.
وظيفتك الأساسية هي إفادة الزوار وتقديم معلومات غنية عن القطع الأثرية والمعروضات المتواجدة في متاحف جامعة المنيا الثلاثة:
1. متحف كلية السياحة والفنادق (معروضات سياحية وتاريخية).
2. متحف كلية الفنون الجميلة (لوحات وأعمال فنية وتماثيل).
3. متحف كلية العلوم (قطع وأدوات علمية وعينات مجهرية).

⚠️ شروط هامة جداً:
1. يجب أن تكون إجاباتك ذكية وموجزة وباللغة العربية الفصحى البسيطة والودودة.
2. إذا سألك المستخدم عن أي موضوع خارج نطاق متاحف جامعة المنيا (مثلاً: الطبخ، البرمجة، أخبار العالم، الرياضة، الترجمة العامة)، يجب عليك الاعتذار بلباقة تامة وإخباره بأنك متخصص فقط في متاحف جامعة المنيا وتاريخها.
3. استند دائماً للبيانات المتاحة لتقديم إجابة حقيقية وموثوقة ولا تخترع معلومات غير موجودة.`;

    const getArtifactTitle = (artifact) => {
        return artifact['name-ar'] || artifact.name || artifact.title || 'قطعة أثرية';
    };

    const getArtifactDescription = (artifact) => {
        return artifact['description-ar'] || artifact.description || artifact.desc || '';
    };

    const renderArtifacts = (artifacts) => {
        const artifactsGrid = document.getElementById('artifacts-grid');
        if (!artifactsGrid) return;

        artifactsGrid.innerHTML = '';

        if (!artifacts || !artifacts.length) {
            artifactsGrid.innerHTML = `
                <div class="col-12 text-center py-5">
                    <div class="mobile-info-card">
                        <h3>لا توجد نتائج للبحث.</h3>
                        <p class="text-muted">جرب البحث بكلمات أخرى</p>
                    </div>
                </div>
            `;
            return;
        }

        const fragment = document.createDocumentFragment();

        artifacts.forEach((artifact) => {
            const bucketId = getBucketByType(currentMuseumCollection);
            const imageUrl = getAppwriteImageUrl(artifact.image || artifact.image_url, bucketId);
            const artifactId = artifact.$id || artifact.id || '';
            const artifactTitle = getArtifactTitle(artifact);
            
            // Subtitle logic like Flutter app
            let subtitle = '';
            if (currentMuseumCollection.includes('tourism')) {
                subtitle = artifact['era-ar'] || artifact.era || '';
            } else if (currentMuseumCollection.includes('art')) {
                subtitle = artifact['author-ar'] || artifact.author || '';
            } else if (currentMuseumCollection.includes('science')) {
                subtitle = artifact['category-ar'] || artifact.category || '';
            }

            const artifactLink = `artifact.html?id=${encodeURIComponent(artifactId)}&collection=${encodeURIComponent(currentMuseumCollection)}&museum=${encodeURIComponent(currentMuseumName)}`;

            const col = document.createElement('div');
            col.className = 'col-lg-3 col-md-4 col-6 mb-4';

            col.innerHTML = `
                <a href="${artifactLink}" class="artifact-card-link">
                    <div class="artifact-card">
                        <div class="artifact-card-img">
                            <img
                                src="${imageUrl || 'assets/placeholder.png'}"
                                alt="${artifactTitle}"
                                loading="lazy"
                            >
                        </div>
                        <div class="artifact-card-overlay"></div>
                        <div class="artifact-card-body">
                            <h3 class="artifact-card-title">${artifactTitle}</h3>
                            <p class="artifact-card-subtitle">${subtitle}</p>
                        </div>
                    </div>
                </a>
            `;

            fragment.appendChild(col);
            
            // Attach fallback
            const img = col.querySelector('img');
            setupImageFallback(img, artifact.image || artifact.image_url);
        });

        artifactsGrid.appendChild(fragment);
    };

    const filterMuseumArtifacts = () => {
        const query = artifactSearchInput ? artifactSearchInput.value.trim().toLowerCase() : '';

        const filteredArtifacts = museumArtifactsCache.filter((artifact) => {
            return getArtifactTitle(artifact)
                .toLowerCase()
                .includes(query);
        });

        renderArtifacts(filteredArtifacts);
    };

    const addMessage = (text, sender) => {

        if (!chatMessages) return;

        const msgDiv = document.createElement('div');

        msgDiv.classList.add('message');
        msgDiv.classList.add(
            sender === 'user' ? 'user-msg' : 'system-msg'
        );

        msgDiv.innerText = text;

        chatMessages.appendChild(msgDiv);

        chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    const handleChat = async () => {

        const text = userInput.value.trim();

        if (!text) return;

        addMessage(text, 'user');

        userInput.value = '';

        const thinkingDiv = document.createElement('div');

        thinkingDiv.classList.add(
            'message',
            'system-msg',
            'thinking'
        );

        thinkingDiv.innerText = 'جاري التفكير...';

        chatMessages.appendChild(thinkingDiv);

        try {

            if (!GEMINI_API_KEY) {
                thinkingDiv.remove();

                addMessage(
                    'مفتاح Gemini غير مضبوط. الرجاء تحديث ملف script.js.',
                    'system'
                );

                return;
            }

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
                {
                    method: 'POST',

                    headers: {
                        'Content-Type': 'application/json'
                    },

                    body: JSON.stringify({
                        systemInstruction: {
                            parts: [{ text: SYSTEM_PROMPT }]
                        },
                        contents: [
                            {
                                parts: [{ text: text }]
                            }
                        ]
                    })
                }
            );

            const data = await response.json();
            thinkingDiv.remove();

            if (!response.ok) {
                addMessage(
                    data.error?.message || 'حدث خطأ أثناء الاتصال بالخادم.',
                    'system'
                );
                return;
            }

            if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {

                addMessage(
                    data.candidates[0].content.parts[0].text,
                    'system'
                );

            } else {

                addMessage(
                    'حدث خطأ أثناء الاتصال بالخادم.',
                    'system'
                );
            }

        } catch (error) {

            thinkingDiv.remove();

            addMessage(
                'حدث خطأ في الاتصال.',
                'system'
            );

            console.error(error);
        }
    };

    if (sendBtn) {
        sendBtn.addEventListener('click', handleChat);
    }

    if (userInput) {

        userInput.addEventListener('keypress', (e) => {

            if (e.key === 'Enter') {
                handleChat();
            }

        });
    }

    if (artifactSearchInput) {
        artifactSearchInput.addEventListener('input', filterMuseumArtifacts);
    }

    // Appwrite Integration
    if (typeof Appwrite !== 'undefined' && databases) {

        window.initMuseumPage = async (
            collectionId,
            museumName
        ) => {

            const artifactsGrid =
                document.getElementById('artifacts-grid');
            const museumTitleHero = document.getElementById('museum-title-hero');
            const museumHeroImg = document.getElementById('museum-hero-img');

            if (!artifactsGrid) return;

            currentMuseumCollection = collectionId;
            currentMuseumName = museumName;
            museumArtifactsCache = [];

            if (museumTitleHero) museumTitleHero.innerText = museumName;
            
            // Set Hero Image based on museum type
            if (museumHeroImg) {
                if (collectionId.includes('tourism')) museumHeroImg.src = 'assets/tourism.png';
                else if (collectionId.includes('art')) museumHeroImg.src = 'assets/art.png';
                else if (collectionId.includes('science')) museumHeroImg.src = 'assets/science.png';
            }

            try {

                const response =
                    await databases.listDocuments(
                        AppwriteConfig.databaseId,
                        collectionId
                    );

                museumArtifactsCache = response.documents || [];
                artifactsGrid.innerHTML = '';

                if (!museumArtifactsCache.length) {
                    artifactsGrid.innerHTML = `
                        <div class="col-12 text-center py-5">
                            <h3>لا توجد قطع أثرية في هذا المتحف.</h3>
                        </div>
                    `;
                    return;
                }

                renderArtifacts(museumArtifactsCache);

            } catch (error) {

                console.error(
                    'Error fetching artifacts:',
                    error
                );

                artifactsGrid.innerHTML = `
                    <div class="col-12 text-center py-5">
                        <h3>
                            حدث خطأ أثناء تحميل البيانات
                        </h3>
                    </div>
                `;
            }
        };

        window.initArtifactPage = async (
            documentId,
            collectionId,
            museumName
        ) => {

            const loader = document.getElementById('loader');
            const artifactContent = document.getElementById('artifact-content');
            const artifactDesc = document.getElementById('artifact-desc');
            const infoCard = document.getElementById('info-card');
            const audioSection = document.getElementById('audio-section');
            const audioPlayer = document.getElementById('artifact-audio');
            const artifactImg = document.getElementById('artifact-img');
            const playPauseBtn = document.getElementById('play-pause-btn');
            const waveformContainer = document.getElementById('waveform');
            const currentTimeEl = document.getElementById('current-time');
            const durationTimeEl = document.getElementById('duration-time');

            if (loader) loader.style.display = 'block';
            if (artifactContent) artifactContent.style.display = 'none';

            try {
                const artifact = await databases.getDocument(
                    AppwriteConfig.databaseId,
                    collectionId,
                    documentId
                );

                const artifactNameHero = document.getElementById('artifact-name-hero');
                const artifactSubtitleHero = document.getElementById('artifact-subtitle-hero');
                const infoGrid = document.getElementById('info-grid');

                const name = getArtifactTitle(artifact);
                if (artifactNameHero) artifactNameHero.innerText = name;
                
                let subtitle = '';
                if (collectionId.includes('tourism')) {
                    subtitle = artifact['era-ar'] || artifact.era || 'عصر غير محدد';
                    if (subtitle && !subtitle.includes('عصر')) subtitle = `العصر: ${subtitle}`;
                } else if (collectionId.includes('art')) {
                    subtitle = artifact['author-ar'] || artifact.author || 'فنان غير معروف';
                } else if (collectionId.includes('science')) {
                    subtitle = artifact['category-ar'] || artifact.category || 'تصنيف علمي';
                }
                if (artifactSubtitleHero) artifactSubtitleHero.innerText = subtitle;

                const bucketId = getBucketByType(collectionId);
                const imgId = artifact.image || artifact.image_url;
                const imgUrl = getAppwriteImageUrl(imgId, bucketId);

                if (artifactImg && imgUrl) {
                    artifactImg.src = imgUrl;
                    setupImageFallback(artifactImg, imgId);
                }

                if (artifactDesc) {
                    artifactDesc.innerText = getArtifactDescription(artifact) || 'لا يوجد وصف متاح لهذه القطعة.';
                }

                if (infoGrid) {
                    const items = [];
                    const addItem = (label, value, icon) => {
                        if (!value || value === 'none' || value === 'null') return;
                        items.push(`
                            <div class="info-item">
                                <div class="info-icon"><i class="fas ${icon}"></i></div>
                                <div class="info-content">
                                    <span class="label">${label}</span>
                                    <span class="value">${value}</span>
                                </div>
                            </div>
                        `);
                    };

                    const era = artifact['era-ar'] || artifact.era || artifact.period;
                    const material = artifact['material-ar'] || artifact.material;
                    const dimensions = artifact['dimensions-ar'] || artifact.dimensions;
                    const location = artifact['location-ar'] || artifact.location;
                    const author = artifact['author-ar'] || artifact.author;
                    const size = artifact['size-ar'] || artifact.size;

                    if (era && era !== 'none') addItem('العصر التاريخي', era, 'fa-landmark');
                    if (material && material !== 'none') addItem('مادة الصنع', material, 'fa-gem');
                    if (dimensions && dimensions !== 'none') addItem('القياسات', dimensions, 'fa-ruler-combined');
                    if (author && author !== 'none') addItem('الفنان/المبدع', author, 'fa-user-edit');
                    if (location && location !== 'none') addItem('موقع الاكتشاف', location, 'fa-map-marked-alt');
                    if (size && size !== 'none') addItem('الحجم', size, 'fa-expand-arrows-alt');

                    infoGrid.innerHTML = items.length ? items.join('') : '<p class="text-muted">لا توجد تفاصيل إضافية متاحة.</p>';
                }

                const audioFileId = artifact['audio-ar'] || artifact.audio_ar || artifact.audio || artifact['audio-en'] || artifact.audio_en || artifact.audio_url || artifact.audioUrl || artifact.audio_guide || artifact.audio_id;

                if (audioSection && audioPlayer && audioFileId && audioFileId !== 'none' && audioFileId !== 'null' && String(audioFileId).trim() !== '') {
                    const audioUrl = getAppwriteImageUrl(audioFileId, AppwriteConfig.buckets.audio);
                    
                    // Audio Player Logic - Set handlers BEFORE src to avoid race conditions
                    if (playPauseBtn && waveformContainer) {
                        waveformContainer.innerHTML = '';
                        const barsCount = 35;
                        for (let i = 0; i < barsCount; i++) {
                            const bar = document.createElement('div');
                            bar.className = 'waveform-bar';
                            const height = Math.floor(Math.sin(i * 0.5) * 15) + 20 + Math.floor(Math.random() * 10);
                            bar.style.height = `${height}px`;
                            waveformContainer.appendChild(bar);
                        }

                        const bars = waveformContainer.querySelectorAll('.waveform-bar');

                        playPauseBtn.disabled = true;
                        playPauseBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

                        // Reset progress
                        currentTimeEl.innerText = '00:00';
                        durationTimeEl.innerText = '00:00';

                        audioPlayer.oncanplay = () => {
                            playPauseBtn.disabled = false;
                            playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
                        };

                        audioPlayer.onerror = () => {
                            playPauseBtn.disabled = true;
                            playPauseBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
                            console.error("Audio failed to load from ID:", audioFileId);
                            // Hide section if it fails completely? Maybe just show error icon.
                        };

                        playPauseBtn.onclick = () => {
                            if (audioPlayer.paused) {
                                audioPlayer.play().catch(err => {
                                    console.error("Playback failed:", err);
                                    playPauseBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
                                });
                                playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
                                waveformContainer.classList.add('playing');
                            } else {
                                audioPlayer.pause();
                                playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
                                waveformContainer.classList.remove('playing');
                            }
                        };

                        audioPlayer.ontimeupdate = () => {
                            if (isNaN(audioPlayer.duration) || audioPlayer.duration === 0) return;
                            
                            const progress = audioPlayer.currentTime / audioPlayer.duration;
                            const activeBarsCount = Math.floor(progress * barsCount);
                            
                            bars.forEach((bar, index) => {
                                if (index < activeBarsCount) {
                                    bar.classList.add('active');
                                } else {
                                    bar.classList.remove('active');
                                }
                            });

                            currentTimeEl.innerText = formatTime(audioPlayer.currentTime);
                            durationTimeEl.innerText = formatTime(audioPlayer.duration);
                        };

                        audioPlayer.onended = () => {
                            playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
                            bars.forEach(bar => bar.classList.remove('active'));
                            waveformContainer.classList.remove('playing');
                        };

                        function formatTime(seconds) {
                            if (isNaN(seconds)) return '00:00';
                            const min = Math.floor(seconds / 60);
                            const sec = Math.floor(seconds % 60);
                            return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
                        }

                        // Now set the source
                        audioPlayer.src = audioUrl;
                        audioPlayer.load(); // Force load
                        audioSection.style.display = 'block';
                    }
                } else if (audioSection) {
                    audioSection.style.display = 'none';
                }

            } catch (error) {
                console.error('Error loading artifact:', error);
            } finally {
                if (loader) loader.style.display = 'none';
                if (artifactContent) artifactContent.style.display = 'block';
            }
        };
    }

    // Helpers
    function getBucketByType(collectionId) {
        if (!collectionId) return AppwriteConfig.buckets.tourism;

        // Matching Flutter's getBucketByType logic
        if (collectionId.includes('science') || collectionId.includes('art')) {
            return AppwriteConfig.buckets.artifacts; // 69f686e9002f917ec2a2
        }
        
        if (collectionId.includes('tourism')) {
            return AppwriteConfig.buckets.tourism; // 69f7d68c003821997d0d
        }

        return AppwriteConfig.buckets.tourism;
    }

    // FIXED IMAGE URL with Fallback
    function getAppwriteImageUrl(fileId, bucketId) {
        if (!fileId) return 'assets/placeholder.png';
        if (Array.isArray(fileId)) fileId = fileId[0];
        if (typeof fileId === 'string' && (fileId.startsWith('http') || fileId.startsWith('assets/'))) {
            return fileId;
        }
        fileId = fileId.toString().trim();
        const action = bucketId === AppwriteConfig.buckets.audio ? 'view' : 'preview';
        return `${AppwriteConfig.endpoint}/storage/buckets/${bucketId}/files/${fileId}/${action}?project=${AppwriteConfig.projectId}`;
    }

    // Advanced Fallback System for Images
    function setupImageFallback(imgEl, fileId) {
        if (!imgEl || !fileId) return;
        
        const buckets = [
            AppwriteConfig.buckets.tourism,
            AppwriteConfig.buckets.artifacts,
            AppwriteConfig.buckets.scienceImages,
            AppwriteConfig.buckets.artImages
        ];
        
        let currentTry = 0;
        
        imgEl.onerror = () => {
            if (currentTry < buckets.length) {
                const nextBucket = buckets[currentTry++];
                const nextUrl = `${AppwriteConfig.endpoint}/storage/buckets/${nextBucket}/files/${fileId}/preview?project=${AppwriteConfig.projectId}`;
                if (imgEl.src !== nextUrl) {
                    imgEl.src = nextUrl;
                    const heroBg = document.getElementById('artifact-hero-bg');
                    if (heroBg && imgEl.id === 'artifact-img') heroBg.src = nextUrl;
                }
            } else {
                imgEl.src = 'assets/placeholder.png';
                imgEl.onerror = null;
            }
        };
    }

    // Smart Services & Activation Logic
    const updateActivationUI = () => {
        const isPremium = localStorage.getItem('mat7afi_premium') === 'true';
        const isLifetime = localStorage.getItem('mat7afi_is_lifetime') === 'true';
        const expiryDateStr = localStorage.getItem('mat7afi_expiry_date');
        
        let shouldBePremium = isPremium;
        if (isPremium && !isLifetime && expiryDateStr) {
            const expiryDate = new Date(expiryDateStr);
            if (new Date() > expiryDate) {
                shouldBePremium = false;
                localStorage.setItem('mat7afi_premium', 'false');
            }
        }

        const statusCard = document.querySelector('.status-card');
        if (!statusCard) return;

        if (shouldBePremium) {
            statusCard.classList.add('premium');
            const h3 = statusCard.querySelector('h3');
            const p = statusCard.querySelector('p');
            const icon = statusCard.querySelector('i');
            const inputGroup = statusCard.querySelector('.activation-input-group');
            
            if (h3) h3.innerText = 'الخدمات الذكية مفعلة';
            if (p) {
                if (isLifetime) {
                    p.innerText = 'تفعيل مدى الحياة ✨ استمتع بكافة التقنيات الذكية.';
                } else if (expiryDateStr) {
                    const date = new Date(expiryDateStr).toLocaleDateString('ar-EG');
                    p.innerText = `تفعيل مؤقت - ينتهي في ${date}. استمتع بالخدمات الآن.`;
                }
            }
            if (icon) icon.className = 'fas fa-check-circle text-success';
            if (inputGroup) inputGroup.style.display = 'none';
        }
    };

    window.handleCodeActivation = async () => {
        const input = document.getElementById('activation-code-input');
        if (!input) return;
        
        const code = input.value.trim();
        if (!code) {
            alert('الرجاء إدخال كود التفعيل أولاً.');
            return;
        }

        if (typeof Appwrite !== 'undefined' && databases) {
            // Show loading state
            const btn = document.querySelector('.btn-activate-v2');
            const originalContent = btn ? btn.innerHTML : '';
            if (btn) {
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحقق...';
                btn.disabled = true;
            }

            try {
                // Query activation_codes collection
                const response = await databases.listDocuments(
                    AppwriteConfig.databaseId,
                    AppwriteConfig.collections.activation,
                    [
                        Appwrite.Query.equal('code', code.toUpperCase())
                    ]
                );

                if (response.documents.length > 0) {
                    const doc = response.documents[0];
                    if (doc.is_used) {
                        alert('هذا الكود تم استخدامه من قبل.');
                    } else {
                        const isLifetime = doc.isLifetime ?? true;
                        const durationDays = doc.durationDays ?? 30;
                        
                        let expiryDate = null;
                        if (!isLifetime) {
                            const date = new Date();
                            date.setDate(date.getDate() + durationDays);
                            expiryDate = date.toISOString();
                        }

                        localStorage.setItem('mat7afi_premium', 'true');
                        localStorage.setItem('mat7afi_is_lifetime', isLifetime.toString());
                        if (expiryDate) {
                            localStorage.setItem('mat7afi_expiry_date', expiryDate);
                        }

                        // Mark code as used
                        await databases.updateDocument(
                            AppwriteConfig.databaseId,
                            AppwriteConfig.collections.activation,
                            doc.$id,
                            { is_used: true }
                        );

                        alert('تم تفعيل الخدمات الذكية بنجاح! ✨');
                        updateActivationUI();
                    }
                } else {
                    alert('كود تفعيل غير صحيح. يرجى التأكد من الكود والمحاولة مرة أخرى.');
                }
            } catch (error) {
                console.error('Activation error:', error);
                alert('حدث خطأ أثناء الاتصال بالخادم.');
            } finally {
                if (btn) {
                    btn.innerHTML = originalContent;
                    btn.disabled = false;
                }
            }
        } else {
            alert('نظام قاعدة البيانات غير جاهز حالياً.');
        }
    };

    // Feature Card Click Handlers
    document.querySelectorAll('.smart-feature-card').forEach(card => {
        card.addEventListener('click', () => {
            const isPremium = localStorage.getItem('mat7afi_premium') === 'true';
            const h4 = card.querySelector('h4');
            const title = h4 ? h4.innerText : 'الخدمة';
            
            if (!isPremium) {
                let trials = parseInt(localStorage.getItem('mat7afi_trials') || '3');
                if (trials > 0) {
                    trials--;
                    localStorage.setItem('mat7afi_trials', trials.toString());
                    alert(`أنت تستخدم محاولة مجانية لخدمة: ${title}. متبقي لك ${trials} محاولات.`);
                    handleFeatureAction(title);
                } else {
                    alert('لقد استنفدت محاولاتك المجانية. يرجى إدخال كود التفعيل في البطاقة أعلاه لتنشيط كافة الميزات.');
                    const input = document.getElementById('activation-code-input');
                    if (input) {
                        input.focus();
                        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
            } else {
                handleFeatureAction(title);
            }
        });
    });

    const handleFeatureAction = (featureTitle) => {
        if (featureTitle.includes('المرئي')) {
            const cameraModal = new bootstrap.Modal(document.getElementById('cameraModal'));
            cameraModal.show();
            startWebcam();
        } else if (featureTitle.includes('الواقع المعزز')) {
            alert('سيتم فتح مستعرض الـ AR للقطع المختارة. تأكد أن متصفحك يدعم WebXR.');
            window.location.href = '#museums';
        } else if (featureTitle.includes('الصوتي')) {
            const voiceModal = new bootstrap.Modal(document.getElementById('voiceModal'));
            voiceModal.show();
            startVoiceAssistant();
        } else if (featureTitle.includes('الحوار')) {
            alert('اختر أي قطعة أثرية من المتاحف أدناه لبدء الحوار المباشر معها.');
            window.location.href = '#museums';
        } else if (featureTitle.includes('المعرفة')) {
            startQuiz();
        }
    };

    // --- AI Camera Logic ---
    let stream = null;
    const startWebcam = async () => {
        const video = document.getElementById('webcam');
        const resultBox = document.getElementById('ai-result');
        resultBox.innerHTML = '<p class="text-white-50 small mb-0">وجه الكاميرا نحو القطعة الأثرية واضغط على الزر لبدء التحليل</p>';
        
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            video.srcObject = stream;
        } catch (err) {
            console.error("Camera error:", err);
            resultBox.innerHTML = '<span class="text-danger">فشل الوصول للكاميرا. تأكد من إعطاء الصلاحيات.</span>';
        }
    };

    document.getElementById('cameraModal')?.addEventListener('hidden.bs.modal', () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
    });

    document.getElementById('capture-btn')?.addEventListener('click', async () => {
        const video = document.getElementById('webcam');
        const canvas = document.getElementById('camera-canvas');
        const resultBox = document.getElementById('ai-result');
        const btn = document.getElementById('capture-btn');

        if (!video.srcObject) return;

        // Capture frame
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg');

        // Analysis UI
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحليل...';
        resultBox.classList.add('analyzing');
        resultBox.innerText = 'جاري التعرف على القطعة وتحليل تاريخها...';

        try {
            const base64Data = imageData.split(',')[1];
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        systemInstruction: {
                            parts: [{ text: SYSTEM_PROMPT }]
                        },
                        contents: [
                            {
                                parts: [
                                    { text: "أنت مرشد سياحي خبير في متاحف جامعة المنيا. قم بتحليل هذه الصورة وأخبرني باسم القطعة وتاريخها وأهميتها باختصار وباللغة العربية." },
                                    { inline_data: { mime_type: "image/jpeg", data: base64Data } }
                                ]
                            }
                        ]
                    })
                }
            );

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "لم أتمكن من التعرف على هذه القطعة بدقة. حاول مرة أخرى.";
            resultBox.classList.remove('analyzing');
            resultBox.innerText = text;
        } catch (error) {
            resultBox.innerText = 'حدث خطأ في الاتصال بالذكاء الاصطناعي.';
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-search-location me-2"></i> بدء الفحص الذكي';
        }
    });

    // --- AI Voice Logic ---
    const startVoiceAssistant = () => {
        const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.lang = 'ar-SA';
        recognition.start();

        const status = document.getElementById('voice-status');
        const transcript = document.getElementById('voice-transcript');
        const responseBox = document.getElementById('voice-response-box');
        const responseText = document.getElementById('voice-response');

        recognition.onresult = async (event) => {
            const userText = event.results[0][0].transcript;
            transcript.innerText = userText;
            status.innerText = 'جاري التفكير...';

            // Ask Gemini
            try {
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            systemInstruction: {
                                parts: [{ text: SYSTEM_PROMPT }]
                            },
                            contents: [{ parts: [{ text: `أجب عن هذا السؤال المتعلق بمتاحف جامعة المنيا باختصار كمرشد سياحي: ${userText}` }] }]
                        })
                    }
                );
                const data = await response.json();
                const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "عذراً، لم أفهم ذلك.";
                
                status.innerText = 'الإجابة:';
                responseBox.classList.remove('d-none');
                responseText.innerText = aiText;

                // Speech Synthesis
                const utterance = new SpeechSynthesisUtterance(aiText);
                utterance.lang = 'ar-SA';
                window.speechSynthesis.speak(utterance);
            } catch (err) {
                status.innerText = 'حدث خطأ.';
            }
        };

        recognition.onerror = () => {
            status.innerText = 'فشل الاستماع.';
        };
    };

    // --- Knowledge Quiz Logic ---
    const startQuiz = () => {
        const questions = [
            { q: "في أي عصر تم بناء أهرامات الجيزة؟", a: "الدولة القديمة" },
            { q: "ما هي عاصمة مصر في عهد إخناتون؟", a: "تل العمارنة" },
            { q: "من هو الإله الذي كان يرمز له بالصقر؟", a: "حورس" }
        ];
        const randomQ = questions[Math.floor(Math.random() * questions.length)];
        const reply = prompt(`تحدي المعرفة:\n${randomQ.q}`);
        if (reply && reply.includes(randomQ.a)) {
            alert('أحسنت! إجابة صحيحة عبقرية. 🎯');
        } else {
            alert(`للأسف إجابة خاطئة. الإجابة الصحيحة هي: ${randomQ.a}`);
        }
    };

    updateActivationUI();

});