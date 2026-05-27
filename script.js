// Mat7afi - AI Chatbot & UI Logic
// All functions are global to avoid DOMContentLoaded race conditions

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
let museumArtifactsCache = [];
let currentMuseumCollection = '';
let currentMuseumName = '';

// Initialize Appwrite Immediately
if (typeof Appwrite !== 'undefined') {
    const { Client, Databases } = Appwrite;
    const client = new Client();
    client
        .setEndpoint(AppwriteConfig.endpoint)
        .setProject(AppwriteConfig.projectId);
    databases = new Databases(client);
}

// Global Core Functions
const getArtifactTitle = (artifact) => {
    return artifact['name-ar'] || artifact.name || artifact.title || 'قطعة أثرية';
};

const getArtifactDescription = (artifact) => {
    return artifact['description-ar'] || artifact.description || artifact.desc || '';
};

// Helpers
function getBucketByType(collectionId) {
    if (!collectionId) return AppwriteConfig.buckets.tourism;
    if (collectionId.includes('science') || collectionId.includes('art')) {
        return AppwriteConfig.buckets.artifacts; 
    }
    return AppwriteConfig.buckets.tourism;
}

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

function setupImageFallback(imgEl, fileId) {
    if (!imgEl || !fileId) return;
    const buckets = [
        AppwriteConfig.buckets.artifacts,
        AppwriteConfig.buckets.tourism,
        AppwriteConfig.buckets.artImages,
        AppwriteConfig.buckets.scienceImages
    ];
    let currentIdx = 0;
    imgEl.onerror = () => {
        if (currentIdx < buckets.length) {
            imgEl.src = getAppwriteImageUrl(fileId, buckets[currentIdx++]);
        } else {
            imgEl.src = 'assets/placeholder.png';
            imgEl.onerror = null;
        }
    };
}

const renderArtifacts = (artifacts) => {
    const artifactsGrid = document.getElementById('artifacts-grid');
    if (!artifactsGrid) return;

    artifactsGrid.innerHTML = '';

    if (!artifacts || !artifacts.length) {
        artifactsGrid.innerHTML = `
            <div class="col-12 text-center py-5">
                <div class="mobile-info-card" style="background: rgba(255,255,255,0.05); padding: 30px; border-radius: 20px;">
                    <h3 class="text-white">لا توجد نتائج للبحث.</h3>
                    <p class="text-white-50">جرب البحث بكلمات أخرى</p>
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
            <a href="${artifactLink}" class="artifact-card-link" style="text-decoration:none;">
                <div class="artifact-card">
                    <div class="artifact-card-img">
                        <img src="${imageUrl}" alt="${artifactTitle}" loading="lazy">
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
        const img = col.querySelector('img');
        setupImageFallback(img, artifact.image || artifact.image_url);
    });

    artifactsGrid.appendChild(fragment);
};

// Global Page Initializers
window.initMuseumPage = async (collectionId, museumName) => {
    const artifactsGrid = document.getElementById('artifacts-grid');
    const museumTitleHero = document.getElementById('museum-title-hero');
    const museumHeroImg = document.getElementById('museum-hero-img');

    if (!artifactsGrid) return;
    
    currentMuseumCollection = collectionId;
    currentMuseumName = museumName;
    museumArtifactsCache = [];

    if (museumTitleHero) museumTitleHero.innerText = museumName;
    
    if (museumHeroImg) {
        if (collectionId.includes('tourism')) museumHeroImg.src = 'assets/tourism-museum.jpg';
        else if (collectionId.includes('art')) museumHeroImg.src = 'assets/artt-museum.jpg';
        else if (collectionId.includes('science')) museumHeroImg.src = 'assets/science-museum.png';
    }

    try {
        const response = await databases.listDocuments(AppwriteConfig.databaseId, collectionId);
        museumArtifactsCache = response.documents || [];
        
        if (!museumArtifactsCache.length) {
            artifactsGrid.innerHTML = `
                <div class="col-12 text-center py-5">
                    <h3 class="text-white">لا توجد قطع أثرية متاحة حالياً في هذا المتحف.</h3>
                </div>
            `;
            return;
        }
        renderArtifacts(museumArtifactsCache);
    } catch (error) {
        console.error('Error fetching artifacts:', error);
        artifactsGrid.innerHTML = `<div class="col-12 text-center py-5"><h3 class="text-danger">حدث خطأ أثناء تحميل البيانات.</h3></div>`;
    }
};

window.initArtifactPage = async (documentId, collectionId, museumName) => {
    const loader = document.getElementById('loader');
    const artifactContent = document.getElementById('artifact-content');
    const artifactDesc = document.getElementById('artifact-desc');
    const audioSection = document.getElementById('audio-section');
    const audioPlayer = document.getElementById('artifact-audio');
    const artifactImg = document.getElementById('artifact-img');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const waveformContainer = document.getElementById('waveform');
    const currentTimeEl = document.getElementById('current-time');
    const durationTimeEl = document.getElementById('duration-time');
    const artifactNameHero = document.getElementById('artifact-name-hero');
    const artifactSubtitleHero = document.getElementById('artifact-subtitle-hero');
    const infoGrid = document.getElementById('info-grid');

    if (loader) loader.style.display = 'block';
    if (artifactContent) artifactContent.style.display = 'none';

    try {
        const artifact = await databases.getDocument(AppwriteConfig.databaseId, collectionId, documentId);
        
        const name = getArtifactTitle(artifact);
        if (artifactNameHero) artifactNameHero.innerText = name;
        
        let subtitle = '';
        if (collectionId.includes('tourism')) {
            subtitle = artifact['era-ar'] || artifact.era || 'عصر غير محدد';
        } else if (collectionId.includes('art')) {
            subtitle = artifact['author-ar'] || artifact.author || 'فنان غير معروف';
        } else if (collectionId.includes('science')) {
            subtitle = artifact['category-ar'] || artifact.category || 'تصنيف علمي';
        }
        if (artifactSubtitleHero) artifactSubtitleHero.innerText = subtitle;

        const bucketId = getBucketByType(collectionId);
        const imgUrl = getAppwriteImageUrl(artifact.image || artifact.image_url, bucketId);
        if (artifactImg) {
            artifactImg.src = imgUrl;
            setupImageFallback(artifactImg, artifact.image || artifact.image_url);
        }

        if (artifactDesc) artifactDesc.innerText = getArtifactDescription(artifact) || 'لا يوجد وصف متاح.';

        // Populate Info Grid
        if (infoGrid) {
            infoGrid.innerHTML = '';
            const fields = [
                { label: 'المتحف', value: museumName, icon: 'fas fa-museum' },
                { label: 'التصنيف', value: collectionId.includes('tourism') ? 'آثار' : (collectionId.includes('art') ? 'فن' : 'علوم'), icon: 'fas fa-tags' }
            ];
            if (collectionId.includes('tourism')) {
                if (artifact['era-ar']) fields.push({ label: 'العصر', value: artifact['era-ar'], icon: 'fas fa-history' });
                if (artifact['location-ar']) fields.push({ label: 'الموقع المستكشف', value: artifact['location-ar'], icon: 'fas fa-map-marker-alt' });
            }
            fields.forEach(f => {
                infoGrid.innerHTML += `
                    <div class="info-item">
                        <div class="info-icon"><i class="${f.icon}"></i></div>
                        <div class="info-content">
                            <span class="label">${f.label}</span>
                            <span class="value">${f.value}</span>
                        </div>
                    </div>
                `;
            });
        }

        // Audio Guide Logic
        const audioFileId = artifact['audio-ar'] || artifact.audio_ar || '';
        if (audioFileId && audioSection && audioPlayer) {
            const audioBucketId = '69f870c0000eb3969260';
            const audioUrl = getAppwriteImageUrl(audioFileId, audioBucketId);
            
            // Audio bars etc...
            const barsCount = 20;
            waveformContainer.innerHTML = '';
            const bars = [];
            for (let i = 0; i < barsCount; i++) {
                const bar = document.createElement('div');
                bar.className = 'wave-bar';
                bar.style.height = `${Math.random() * 60 + 20}%`;
                waveformContainer.appendChild(bar);
                bars.push(bar);
            }

            audioPlayer.src = audioUrl;
            audioPlayer.load();
            audioSection.style.display = 'block';

            playPauseBtn.onclick = () => {
                if (audioPlayer.paused) {
                    audioPlayer.play();
                    playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
                } else {
                    audioPlayer.pause();
                    playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
                }
            };

            audioPlayer.ontimeupdate = () => {
                if (!audioPlayer.duration) return;
                const progress = audioPlayer.currentTime / audioPlayer.duration;
                const active = Math.floor(progress * barsCount);
                bars.forEach((b, i) => b.classList.toggle('active', i < active));
                if (currentTimeEl) currentTimeEl.innerText = formatTime(audioPlayer.currentTime);
                if (durationTimeEl) durationTimeEl.innerText = formatTime(audioPlayer.duration);
            };
        }

    } catch (err) { console.error(err); } finally {
        if (loader) loader.style.display = 'none';
        if (artifactContent) artifactContent.style.display = 'block';
    }
};

function formatTime(s) {
    const m = Math.floor(s/60); const sc = Math.floor(s%60);
    return `${m.toString().padStart(2,'0')}:${sc.toString().padStart(2,'0')}`;
}

// DOM Dependent Events
document.addEventListener('DOMContentLoaded', () => {
    const artifactSearchInput = document.getElementById('artifact-search');
    if (artifactSearchInput) {
        artifactSearchInput.oninput = () => {
            const q = artifactSearchInput.value.toLowerCase();
            renderArtifacts(museumArtifactsCache.filter(a => getArtifactTitle(a).toLowerCase().includes(q)));
        };
    }

    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    if (sendBtn && userInput) {
        sendBtn.onclick = handleChat;
        userInput.onkeypress = (e) => { if (e.key === 'Enter') handleChat(); };
    }
});

async function handleChat() {
    const userInput = document.getElementById('user-input');
    const chatMessages = document.getElementById('chat-messages');
    const text = userInput.value.trim();
    if (!text) return;
    
    const addMsg = (t, s) => {
        const d = document.createElement('div');
        d.className = `message ${s}-msg`;
        d.innerText = t;
        chatMessages.appendChild(d);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    addMsg(text, 'user');
    userInput.value = '';
    const thinking = document.createElement('div');
    thinking.className = 'message system-msg thinking';
    thinking.innerText = 'جاري التفكير...';
    chatMessages.appendChild(thinking);

    const SYSTEM_PROMPT = `أنت Ego Pro مساعد متاحف جامعة المنيا...`;
    const API_KEY = 'AIzaSyCrTSLql-6iD0V4FhgKN3dTLnGJb9ln8eE';

    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: text }] }] })
        });
        const data = await res.json();
        thinking.remove();
        const responseText = data.candidates[0].content.parts[0].text;
        addMsg(responseText, 'system');
    } catch (e) { thinking.remove(); addMsg('خطأ في الاتصال', 'system'); }
}