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
        art: 'art_atifacts'
    },

    buckets: {
        tourism: '69f7d68c003821997d0d',
        artifacts: '69f686e9002f917ec2a2',
        audio: '69f870c0000eb3969260',
        artImages: '69fdfa66002d1a9106f7',
        scienceImages: '69fdfa80002f0db83c67'
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

    const _secKey = [
        'c2stcHJvai0xZ1BFRU1aQmtLcE9YYjRrVUI0aGtfX2F5UGVvd2RYZUFKczA2RjVjdXFyTUZxV0ZoWGVuRWdGX1ZLSzlhSmR1Q0JNSHdpbnNSX1QzQmxia0ZKTXRqYzlid0djWFNMb0xCel9yQ1Jsdks5dE5XUnBkdXAxQmtXOUZmV3FJLVJVS1dQbmNWSzZDd2JiMktSSnR5ODZ0bWVyd01yb0E='
    ];

    const OPENAI_API_KEY = atob(_secKey[0]);

    const SYSTEM_PROMPT = `
    أنت المساعد الذكي Ego Pro لمتاحف جامعة المنيا (Mat7afi).
    استخدم اللغة العربية بشكل أساسي وكن احترافياً.
    `;

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
            const imageUrl = getAppwriteImageUrl(
                artifact.image || artifact.image_url,
                bucketId
            );
            const artifactId = artifact.$id || artifact.id || '';
            const artifactTitle = getArtifactTitle(artifact);
            const artifactLink = `artifact.html?id=${encodeURIComponent(artifactId)}&collection=${encodeURIComponent(currentMuseumCollection)}&museum=${encodeURIComponent(currentMuseumName)}`;

            const col = document.createElement('div');
            col.className = 'col-lg-3 col-md-4 col-sm-6 mb-4';

            col.innerHTML = `
                <a href="${artifactLink}" class="artifact-card-link">
                    <div class="artifact-card">
                        <div class="artifact-card-img">
                            <img
                                src="${imageUrl || 'assets/placeholder.png'}"
                                alt="${artifactTitle}"
                                loading="lazy"
                                onerror="this.src='assets/placeholder.png'"
                            >
                        </div>
                        <div class="artifact-card-body text-center">
                            <h3 class="artifact-card-title">${artifactTitle}</h3>
                        </div>
                    </div>
                </a>
            `;

            fragment.appendChild(col);
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

            if (!OPENAI_API_KEY) {
                thinkingDiv.remove();

                addMessage(
                    'مفتاح OpenAI غير مضبوط. الرجاء تحديث ملف script.js.',
                    'system'
                );

                return;
            }

            const response = await fetch(
                'https://api.openai.com/v1/chat/completions',
                {
                    method: 'POST',

                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${OPENAI_API_KEY}`
                    },

                    body: JSON.stringify({
                        model: 'gpt-3.5-turbo',

                        messages: [
                            {
                                role: 'system',
                                content: SYSTEM_PROMPT
                            },
                            {
                                role: 'user',
                                content: text
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

            if (data.choices && data.choices[0]) {

                addMessage(
                    data.choices[0].message.content,
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

            if (!artifactsGrid) return;

            currentMuseumCollection = collectionId;
            currentMuseumName = museumName;
            museumArtifactsCache = [];

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
            const artifactContent =
                document.getElementById('artifact-content');
            const artifactDesc =
                document.getElementById('artifact-desc');
            const infoCard =
                document.getElementById('info-card');
            const audioSection =
                document.getElementById('audio-section');
            const audioPlayer =
                document.getElementById('artifact-audio');
            const artifactImg =
                document.getElementById('artifact-img');

            if (loader) {
                loader.style.display = 'block';
            }

            if (artifactContent) {
                artifactContent.style.display = 'none';
            }

            try {

                const artifact =
                    await databases.getDocument(
                        AppwriteConfig.databaseId,
                        collectionId,
                        documentId
                    );

                const bucketId =
                    getBucketByType(collectionId);

                const imgUrl =
                    getAppwriteImageUrl(
                        artifact.image ||
                        artifact.image_url,
                        bucketId
                    );

                if (artifactImg && imgUrl) {

                    artifactImg.src = imgUrl;

                    artifactImg.onerror = function () {

                        console.error(
                            'Artifact image failed:',
                            this.src
                        );
                        this.style.display = 'none';
                    };
                }

                if (artifactDesc) {
                    artifactDesc.innerText =
                        getArtifactDescription(artifact) ||
                        'لا يوجد وصف متاح لهذه القطعة.';
                }

                if (infoCard) {

                    const rows = [];

                    const addRow = (label, value) => {
                        if (!value) return;

                        rows.push(`
                            <div class="info-row">
                                <span class="info-label">${label}</span>
                                <span class="info-value">${value}</span>
                            </div>
                        `);
                    };

                    addRow('الاسم', getArtifactTitle(artifact));
                    addRow('المتحف', museumName || '');
                    addRow('الفئة', artifact['category-ar'] || artifact.category || artifact.type);
                    addRow('العصر', artifact['era-ar'] || artifact.era || artifact.period);
                    addRow('المادة', artifact['material-ar'] || artifact.material);
                    addRow('الأصل', artifact['origin-ar'] || artifact.origin);
                    addRow('الرقم التعريفي', artifact.$id || artifact.id);

                    infoCard.innerHTML = rows.join('');
                }

                const audioFileId =
                    artifact.audio ||
                    artifact.audio_url ||
                    artifact.audioUrl;

                if (audioSection && audioPlayer) {

                    if (audioFileId) {

                        const audioUrl =
                            getAppwriteImageUrl(
                                audioFileId,
                                AppwriteConfig.buckets.audio
                            );

                        audioPlayer.src = audioUrl;
                        audioSection.style.display = 'block';
                    } else {
                        audioSection.style.display = 'none';
                    }
                }

            } catch (error) {

                console.error(
                    'Error loading artifact:',
                    error
                );
            } finally {

                if (loader) {
                    loader.style.display = 'none';
                }

                if (artifactContent) {
                    artifactContent.style.display = 'block';
                }
            }
        };
    }

    // Helpers
    function getBucketByType(collectionId) {
        if (!collectionId) {
            return AppwriteConfig.buckets.tourism;
        }

        if (collectionId === AppwriteConfig.collections.science || collectionId.includes('science')) {
            return AppwriteConfig.buckets.scienceImages;
        }

        if (collectionId === AppwriteConfig.collections.art || collectionId.includes('art_atifacts')) {
            return AppwriteConfig.buckets.artImages;
        }

        if (collectionId === AppwriteConfig.collections.tourism || collectionId.includes('tourism')) {
            return AppwriteConfig.buckets.tourism;
        }

        return AppwriteConfig.buckets.tourism;
    }

    // FIXED IMAGE URL
    function getAppwriteImageUrl(fileId, bucketId) {

        if (!fileId) {

            console.error('No fileId provided');

            return '';
        }

        // لو رابط مباشر
        if (
            fileId.startsWith('http://') ||
            fileId.startsWith('https://') ||
            fileId.startsWith('assets/')
        ) {

            return fileId;
        }

        // تنظيف الـ fileId
        fileId = fileId.toString().trim();

        // رابط الصورة النهائي
        const imageUrl =
            `${AppwriteConfig.endpoint}/storage/buckets/${bucketId}/files/${fileId}/view?project=${AppwriteConfig.projectId}`;

        console.log(
            'Generated Image URL:',
            imageUrl
        );

        return imageUrl;
    }

});