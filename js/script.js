// Mat7afi - AI Chatbot & UI Logic
// All functions are global to avoid DOMContentLoaded race conditions

window.loadMuseumArtifacts = (collectionId, museumName, museumImg) => {
    let url = `museum.html?id=${collectionId}&name=${encodeURIComponent(museumName)}`;
    if (museumImg && museumImg !== 'null' && museumImg !== 'undefined') {
        url += `&img=${encodeURIComponent(museumImg)}`;
    }
    window.location.href = url;
};

// Protected Configuration (Obfuscated to prevent automated GitHub key scraping)
const _aw_key = "eyJlbmRwb2ludCI6Imh0dHBzOi8vYXBwd3JpdGUuZXRpaGFkYWxtZGluYS5jb20vdjEiLCJwcm9qZWN0SWQiOiI2OWYyMWM3MzAwMDYyMTkzOTQyMiIsImRhdGFiYXNlSWQiOiI2OWY2OTk0ODAwMTBlMmZlZWE4YSIsImNvbGxlY3Rpb25zIjp7InRvdXJpc20iOiJ0b3VyaXNtX2FydGlmYWN0cyIsInNjaWVuY2UiOiJzY2llbmNlX2F0aWZhY3RzIiwiYXJ0IjoiYXJ0X2F0aWZhY3RzIiwiZ2VvbG9neSI6InNjZWllbmNlX211c2V1bV9nZW8iLCJhY3RpdmF0aW9uIjoiYWN0aXZhdGlvbl9jb2RlcyJ9LCJidWNrZXRzIjp7InRvdXJpc20iOiI2OWY3ZDY4YzAwMzgyMTk5N2QwZCIsImFydGlmYWN0cyI6IjY5ZjY4NmU5MDAyZjkxN2VjMmEyIiwiYXVkaW8iOiI2OWY4NzBjMDAwMGViMzk2OTI2MCIsImFydEltYWdlcyI6IjY5ZmRmYTY2MDAyZDFhOTEwNmY3Iiwic2NpZW5jZUltYWdlcyI6IjY5ZmRmYTgwMDAyZjBkYjgzYzY3IiwiYXJNb2RlbHMiOiI2YTEzY2YzNzAwMTdkNGZmNzAwNiIsImdlb0ltYWdlcyI6IjZhMjc1NjE3MDAwYzg3NjMyMDExIn19";
const AppwriteConfig = JSON.parse(atob(_aw_key));
// Appwrite collection ID uses legacy typo: art_atifacts (not art_artifacts)
AppwriteConfig.collections.art = 'art_atifacts';
AppwriteConfig.collections.zoology = 'zoology_museum';
AppwriteConfig.buckets.zoologyImages = '6a2b23370034e082f5f3';
AppwriteConfig.buckets.artImages2 = '6a2cc2830001aa980e0a';
AppwriteConfig.buckets.artImages3 = '6a2cc3b7001e1b2b7197';
AppwriteConfig.buckets.artImages4 = '6a2cc3de001cf973b559';

let databases;
let museumArtifactsCache = [];
let currentMuseumCollection = '';
let currentMuseumName = '';
let currentScienceSubMuseumId = null;

let isTtsActive = true;
let isMainRecording = false;
let mainRecognition = null;

function toggleWebTTS() {
    isTtsActive = !isTtsActive;
    const ttsToggle = document.getElementById('tts-toggle');
    if (ttsToggle) {
        if (isTtsActive) {
            ttsToggle.innerHTML = '<i class="fas fa-volume-up"></i>';
            ttsToggle.style.color = 'white';
        } else {
            ttsToggle.innerHTML = '<i class="fas fa-volume-mute"></i>';
            ttsToggle.style.color = 'rgba(255,255,255,0.4)';
            window.speechSynthesis.cancel();
        }
    }
}

function extractSearchQuery(text) {
    let cleaned = text.toLowerCase();
    cleaned = cleaned.replace(/[؟\?!\.,;\(\)\[\]"“‘\-\+\*\/_#@$]/g, ' ');

    const stopWords = new Set([
        // Arabic conversational/stop words
        'ما', 'هو', 'هي', 'من', 'أين', 'كيف', 'لماذا', 'في', 'على', 'عن', 'منذ', 'إلى', 
        'أريد', 'معلومات', 'حول', 'كلمني', 'صف', 'متحف', 'المتحف', 'أخبرني', 'تحدث', 
        'حدثني', 'تعرف', 'ايه', 'شنو', 'عايز', 'ابغى', 'بدّي', 'شو', 'كيفية', 'يا', 
        'صديقي', 'صحبي', 'صاحبي', 'بالله', 'ممكن', 'لو', 'سمحت', 'ورينا', 'فرجني', 
        'شغل', 'افتح', 'روح', 'اذهب', 'ادخل', 'هات', 'جيب', 'عرض', 'توضيح', 'تفاصيل',
        'القطع', 'القطعة', 'الآثار', 'الاثار', 'تحفة', 'التحف', 'الجدول', 'المعروضة', 
        'معروضات', 'المعروضات',
        // English conversational/stop words
        'what', 'is', 'are', 'who', 'where', 'how', 'why', 'in', 'on', 'about', 'to', 
        'from', 'tell', 'me', 'describe', 'museum', 'artifact', 'show', 'find', 'search', 
        'please', 'can', 'you', 'give', 'details', 'of', 'the', 'an', 'a', 'info', 'information'
    ]);

    let words = cleaned.split(/\s+/);
    let filtered = [];
    for (let word of words) {
        let cleanWord = word.trim();
        if (!cleanWord) continue;
        if (!stopWords.has(cleanWord)) {
            filtered.push(cleanWord);
        }
    }

    if (filtered.length === 0) {
        return text.replace(/[؟\?!\.,;\(\)\[\]"“‘\-\+\*\/_#@$]/g, ' ').trim();
    }
    
    return filtered.join(' ');
}

let Query;
let appwriteAccount; // Global reference for account sessions
// Appwrite initialization helper (deferred to DOMContentLoaded to avoid race)
function initAppwrite() {
    if (typeof Appwrite === 'undefined') {
        console.warn('Appwrite SDK not available yet. Initialization deferred.');
        return false;
    }

    const { Client, Databases, Account, Query: AppwriteQuery } = Appwrite;
    const client = new Client();
    client
        .setEndpoint(AppwriteConfig.endpoint)
        .setProject(AppwriteConfig.projectId);
    databases = new Databases(client);
    appwriteAccount = new Account(client);
    Query = AppwriteQuery;

    // Trigger anonymous session creation in background (does not block)
    appwriteAccount.getSession('current').catch(() => {
        appwriteAccount.createAnonymousSession()
            .then(() => console.log('Appwrite anonymous session created successfully.'))
            .catch(err => console.error('Error creating Appwrite anonymous session:', err));
    });

    return true;
}

// Gemini API Configuration Caching
let cachedGeminiConfig = null;
window.getGeminiConfig = async () => {
    if (cachedGeminiConfig) return cachedGeminiConfig;
    if (!databases) {
        initAppwrite();
    }
    if (!databases) {
        console.warn('Appwrite database client not initialized. Using fallback Gemini config.');
        return {
            apiKey: 'AQ.Ab8RN6KHomaf8JG_p8DCq0nmMt-Eebk7IKkqlPoLh3UBQOYVqw',
            model: 'gemini-1.5-flash'
        };
    }
    
    // Ensure anonymous session is created before fetching config
    if (appwriteAccount) {
        try {
            await appwriteAccount.getSession('current');
        } catch (e) {
            try {
                await appwriteAccount.createAnonymousSession();
            } catch (sessErr) {
                console.error('Failed to establish anonymous session in getGeminiConfig:', sessErr);
            }
        }
    }

    try {
        const response = await databases.listDocuments(
            AppwriteConfig.databaseId,
            'appconfig'
        );
        if (response && response.documents && response.documents.length > 0) {
            const configDoc = response.documents[0];
            cachedGeminiConfig = {
                apiKey: configDoc.gemini_api || configDoc.gemini_api_key || configDoc.geminiApiKey || configDoc.apiKey || configDoc.key || configDoc['gemini-api-key'],
                model: configDoc.gemini_model || configDoc.geminiModel || 'gemini-1.5-pro'
            };
            return cachedGeminiConfig;
        }
    } catch (e) {
        console.error('Error fetching Gemini Config from appconfig, using fallback:', e);
    }
    return {
        apiKey: 'AQ.Ab8RN6KHomaf8JG_p8DCq0nmMt-Eebk7IKkqlPoLh3UBQOYVqw',
        model: 'gemini-1.5-flash'
    };
};

window.getGeminiApiKey = async () => {
    const config = await window.getGeminiConfig();
    return config ? config.apiKey : null;
};

// Global Core Functions
const getCurrentLang = () => sessionStorage.getItem('lang') || 'ar';

const getArtifactTitle = (artifact) => {
    const lang = getCurrentLang();
    return artifact[`title-${lang}`] || artifact[`title_${lang}`] ||
           artifact[`name-${lang}`] || artifact['name-ar'] || artifact.name || artifact.title || 'قطعة أثرية';
};

const getArtifactDescription = (artifact) => {
    const lang = getCurrentLang();
    return artifact[`overview_${lang}`] || artifact[`overview-${lang}`] ||
           artifact[`description-${lang}`] || artifact['description-ar'] || artifact.description || artifact.desc || '';
};

const isGeologyCollection = (collectionId) =>
    collectionId && (collectionId.includes('sceience_museum_geo') || collectionId.includes('geology'));

const isZoologyCollection = (collectionId) =>
    collectionId && (collectionId.includes('zoology_museum') || collectionId.includes('zoology'));

const resolveArtifactImageBucket = (artifact, defaultBucketId) => {
    if (!artifact) return defaultBucketId;
    const explicitBucket = artifact.image_bucket_id || artifact.imageBucketId || 
                           artifact.image_bucket || artifact.imageBucket || 
                           artifact.bucket_id || artifact.bucketId || artifact.bucket;
    if (explicitBucket) return explicitBucket;

    if (defaultBucketId === AppwriteConfig.buckets.artImages) {
        const hallId = String(artifact['art-id'] || artifact.artId || '').trim();
        if (hallId === '2') return AppwriteConfig.buckets.artImages2;
        if (hallId === '3') return AppwriteConfig.buckets.artImages3;
        if (hallId === '4') return AppwriteConfig.buckets.artImages4;
    }
    return defaultBucketId;
};

const formatGeologyValue = (val) => {
    if (val == null) return '';
    if (Array.isArray(val)) {
        return val.map(v => String(v).trim()).filter(Boolean).join('\n');
    }
    const text = String(val).trim();
    return text && text.toLowerCase() !== 'null' ? text : '';
};

const getGeologyField = (artifact, lang, arKeys, enKeys) => {
    const keys = lang === 'ar' ? arKeys : enKeys;
    for (const key of keys) {
        const formatted = formatGeologyValue(artifact[key]);
        if (formatted) return formatted;
    }
    if (lang !== 'ar') {
        for (const key of arKeys) {
            const formatted = formatGeologyValue(artifact[key]);
            if (formatted) return formatted;
        }
    }
    return '';
};

const getGeologyGalleryUrls = (artifact) => {
    const raw = artifact.images || artifact.gallery_images || [];
    const ids = Array.isArray(raw) ? raw : [raw];
    const bucketId = AppwriteConfig.buckets.geoImages;
    return ids
        .map(id => getAppwriteImageUrl(id, bucketId))
        .filter(Boolean);
};

const glbPreloadCache = new Set();
const imagePreloadCache = new Set();
const GALLERY_BUCKET_ID = '6a237511000001e303ff';
let preloadAllStarted = false;

function preloadImageUrl(url) {
    if (!url || imagePreloadCache.has(url)) return;
    imagePreloadCache.add(url);
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
}

function preloadGlbModel(fileId, collectionId) {
    if (!fileId || glbPreloadCache.has(fileId)) return;
    glbPreloadCache.add(fileId);
    const urls = resolveGlbModelUrls(fileId, collectionId);
    urls.slice(0, 2).forEach(url => {
        fetch(url, { mode: 'cors', credentials: 'omit', cache: 'force-cache' }).catch(() => {});
    });
}

function getArtifactGalleryUrls(artifact, bucketId, collectionId) {
    if (collectionId && isGeologyCollection(collectionId)) {
        return getGeologyGalleryUrls(artifact);
    }
    const resolvedBucket = resolveArtifactImageBucket(artifact, bucketId);
    const raw = artifact.images || artifact.gallery_images || artifact.gallery || [];
    const ids = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    return ids.map(id => getAppwriteImageUrl(id, resolvedBucket)).filter(Boolean);
}

function preloadArtifactMedia(artifact, collectionId, bucketId, includeGlb = false) {
    const resolvedBucket = resolveArtifactImageBucket(artifact, bucketId);
    preloadImageUrl(getAppwriteImageUrl(artifact.image || artifact.image_url, resolvedBucket));
    getArtifactGalleryUrls(artifact, resolvedBucket, collectionId).forEach(preloadImageUrl);
    if (includeGlb) {
        const glbId = artifact.glbFileId || artifact.glbFileld || artifact.glb_file_id || '';
        if (glbId && glbId.trim().length > 5) {
            preloadGlbModel(glbId, collectionId);
        }
    }
}

function preloadArtifactsFromCache(artifacts, collectionId) {
    if (!artifacts?.length) return;
    const bucketId = getBucketByType(collectionId);
    artifacts.forEach(artifact => preloadArtifactMedia(artifact, collectionId, bucketId));
}

async function preloadCollectionArtifacts(collectionId, bucketId) {
    if (!databases && !initAppwrite()) return;
    try {
        const queries = Query ? [Query.limit(100)] : [];
        const response = await databases.listDocuments(AppwriteConfig.databaseId, collectionId, queries);
        (response.documents || []).forEach(artifact => preloadArtifactMedia(artifact, collectionId, bucketId));
    } catch (e) {
        console.warn(`Preload skipped for ${collectionId}:`, e);
    }
}

async function preloadGalleryCollection() {
    if (!databases && !initAppwrite()) return;
    try {
        const queries = Query ? [Query.limit(100)] : [];
        const response = await databases.listDocuments(AppwriteConfig.databaseId, 'museum_gallery', queries);
        (response.documents || []).forEach(doc => {
            const coverImg = doc.coverImage;
            const file = doc.fileUrl;
            if (coverImg && coverImg.startsWith('http')) {
                preloadImageUrl(coverImg);
            } else if (coverImg) {
                preloadImageUrl(getAppwriteImageUrl(coverImg, GALLERY_BUCKET_ID));
            } else if (file && (file.startsWith('http') || file.startsWith('assets/'))) {
                preloadImageUrl(file);
            } else if (file) {
                preloadImageUrl(getAppwriteImageUrl(file, GALLERY_BUCKET_ID));
            }
        });
    } catch (e) {
        console.warn('Gallery preload skipped:', e);
    }
}

async function preloadAllMuseumAssets() {
    if (preloadAllStarted) return;
    preloadAllStarted = true;
    if (!databases && !initAppwrite()) {
        // Retry after SDK loads
        let retries = 0;
        const retryInterval = setInterval(() => {
            retries++;
            if (initAppwrite() || retries > 10) {
                clearInterval(retryInterval);
                if (databases) _runPreloadAll();
            }
        }, 300);
        return;
    }
    _runPreloadAll();
}

async function _runPreloadAll() {
    // Aggressively preload ALL museum collections in parallel
    await Promise.allSettled([
        preloadCollectionArtifacts(AppwriteConfig.collections.tourism, AppwriteConfig.buckets.tourism),
        preloadCollectionArtifacts(AppwriteConfig.collections.art, AppwriteConfig.buckets.artImages),
        preloadCollectionArtifacts(AppwriteConfig.collections.art, AppwriteConfig.buckets.artImages2),
        preloadCollectionArtifacts(AppwriteConfig.collections.art, AppwriteConfig.buckets.artImages3),
        preloadCollectionArtifacts(AppwriteConfig.collections.art, AppwriteConfig.buckets.artImages4),
        preloadCollectionArtifacts(AppwriteConfig.collections.science, AppwriteConfig.buckets.scienceImages),
        preloadCollectionArtifacts(AppwriteConfig.collections.geology, AppwriteConfig.buckets.geoImages),
        preloadCollectionArtifacts(AppwriteConfig.collections.zoology, AppwriteConfig.buckets.zoologyImages),
        preloadGalleryCollection()
    ]);
}

function scheduleBackgroundPreload() {
    // Immediately preload static assets
    [
        'assets/tourism-museum.jpg',
        'assets/artt-museum.jpg',
        'assets/science-museum.png',
        'assets/science-museum1.png',
        'assets/متاحف كلية علوم.png',
        'assets/Desktop  2.png',
        'assets/Frame 1.png',
        'assets/Frame 2.png',
        'assets/Frame 3.png',
        'assets/Frame 4.png'
    ].forEach(preloadImageUrl);

    // Start Appwrite artifact preloading immediately (no idle callback delay)
    preloadAllMuseumAssets();
}

async function preloadGeologyCollection() {
    await preloadCollectionArtifacts(AppwriteConfig.collections.geology, AppwriteConfig.buckets.geoImages);
}

async function preloadTourismGlbModels() {
    await preloadCollectionArtifacts(AppwriteConfig.collections.tourism, AppwriteConfig.buckets.tourism);
}

window.preloadImageUrl = preloadImageUrl;
window.preloadAllMuseumAssets = preloadAllMuseumAssets;
window.preloadGalleryCollection = preloadGalleryCollection;
window.preloadArtifactsFromCache = preloadArtifactsFromCache;

window.showToast = window.showToast || function showToast(message, type = 'info') {
    let toast = document.getElementById('mat7afi-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'mat7afi-toast';
        toast.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:#422006;color:#fff;padding:12px 24px;border-radius:12px;font-family:Cairo,sans-serif;font-size:0.95rem;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,0.25);opacity:0;transition:opacity 0.3s;max-width:90%;text-align:center;';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => { toast.style.opacity = '0'; }, 3500);
};

function renderGeologyExtraSections(artifact, lang) {
    const container = document.getElementById('geology-extra-sections');
    if (!container) return;
    container.innerHTML = '';

    const sections = [];
    const t = (ar, en, fr) => lang === 'en' ? en : (lang === 'fr' ? fr : ar);

    const whatToSee = getGeologyField(artifact, lang,
        ['what_you_will_see_ar', 'what_you_will_see-ar', 'what_to_see-ar', 'what_to_see_ar'],
        ['what_you_will_see_en', 'what_you_will_see-en', 'what_to_see-en', 'what_to_see_en']
    );
    if (whatToSee) {
        sections.push({ title: t('ماذا ستشاهد', 'What You Will See', 'Ce que vous verrez'), body: whatToSee });
    }

    const galleryUrls = getGeologyGalleryUrls(artifact);
    if (galleryUrls.length) {
        const galleryId = 'geology-gallery-' + Date.now();
        sections.push({
            title: t('معرض الصور', 'Image Gallery', 'Galerie photos'),
            isGallery: true,
            galleryId,
            urls: galleryUrls
        });
    }

    const journey = getGeologyField(artifact, lang,
        ['journey_ar', 'journey-ar', 'time_journey-ar', 'time_journey_ar'],
        ['journey_en', 'journey-en', 'time_journey-en', 'time_journey_en']
    );
    if (journey) {
        sections.push({ title: t('رحلة عبر الزمن', 'Journey Through Time', 'Voyage dans le temps'), body: journey });
    }

    const importance = getGeologyField(artifact, lang,
        ['importance_ar', 'importance-ar', 'scientific_importance-ar', 'scientific_importance_ar'],
        ['importance_en', 'importance-en', 'scientific_importance-en', 'scientific_importance_en']
    );
    if (importance) {
        sections.push({ title: t('الأهمية العلمية', 'Scientific Importance', 'Importance scientifique'), body: importance });
    }

    const didYouKnow = getGeologyField(artifact, lang,
        ['did_you_know_ar', 'did_you_know-ar'],
        ['did_you_know_en', 'did_you_know-en']
    );
    if (didYouKnow) {
        sections.push({ title: t('هل تعلم؟', 'Did You Know?', 'Le saviez-vous ?'), body: didYouKnow });
    }

    sections.forEach(section => {
        const block = document.createElement('div');
        block.className = 'geology-detail-block';

        if (section.isGallery) {
            block.innerHTML = `
                <h3 class="section-title">${section.title}</h3>
                <div class="geology-gallery" id="${section.galleryId}">
                    <button type="button" class="gallery-nav gallery-prev" aria-label="Previous"><i class="fas fa-chevron-right"></i></button>
                    <div class="gallery-track-wrap"><img class="gallery-track-img" src="${section.urls[0]}" alt=""></div>
                    <button type="button" class="gallery-nav gallery-next" aria-label="Next"><i class="fas fa-chevron-left"></i></button>
                </div>
                <div class="gallery-dots"></div>
            `;
            container.appendChild(block);
            initGeologyGallery(block.querySelector('.geology-gallery'), section.urls);
        } else {
            block.innerHTML = `
                <h3 class="section-title">${section.title}</h3>
                <div class="description-text">${section.body.replace(/\n/g, '<br>')}</div>
            `;
            container.appendChild(block);
        }
    });
}

function renderZoologyExtraSections(artifact, lang) {
    const container = document.getElementById('geology-extra-sections');
    if (!container) return;
    container.innerHTML = '';

    const t = (ar, en, fr) => lang === 'en' ? en : (lang === 'fr' ? fr : ar);

    const getFieldVal = (arKeys, enKeys, frKeys) => {
        const keys = lang === 'en' ? enKeys : (lang === 'fr' ? frKeys : arKeys);
        for (const key of keys) {
            if (artifact[key] && artifact[key].toString().trim().toLowerCase() !== 'null' && artifact[key].toString().trim() !== '') {
                return artifact[key].toString().trim();
            }
        }
        if (lang !== 'ar') {
            for (const key of arKeys) {
                if (artifact[key] && artifact[key].toString().trim().toLowerCase() !== 'null' && artifact[key].toString().trim() !== '') {
                    return artifact[key].toString().trim();
                }
            }
        }
        return '';
    };

    const sections = [];

    const habitat = getFieldVal(
        ['distribution_ar', 'distribution-ar'],
        ['distribution_en', 'distribution-en'],
        ['distribution_fr', 'distribution-fr']
    );
    if (habitat) {
        sections.push({
            title: t('الموطن والتوزيع الجغرافي', 'Habitat & Distribution', 'Habitat et distribution'),
            body: habitat
        });
    }

    const characteristics = getFieldVal(
        ['characteristics_ar', 'characteristics-ar'],
        ['characteristics_en', 'characteristics-en'],
        ['characteristics_fr', 'characteristics-fr']
    );
    if (characteristics) {
        sections.push({
            title: t('الصفات المميزة', 'Distinctive Characteristics', 'Caractéristiques distinctives'),
            body: characteristics
        });
    }

    const reproduction = getFieldVal(
        ['reproduction_ar', 'reproduction-ar', 'Reproduction-AR'],
        ['reproduction_en', 'reproduction-en', 'Reproduction-En'],
        ['reproduction_fr', 'reproduction-fr', 'Reproduction-Fr']
    );
    if (reproduction) {
        sections.push({
            title: t('التكاثر', 'Reproduction', 'Reproduction'),
            body: reproduction
        });
    }

    const diet = getFieldVal(
        ['diet_behavior_ar', 'diet_behavior-ar', 'diet-behavior-ar'],
        ['diet_behavior_en', 'diet_behavior-en', 'diet-behavior-en'],
        ['diet_behavior_fr', 'diet_behavior-fr', 'diet-behavior-fr']
    );
    if (diet) {
        sections.push({
            title: t('الغذاء والسلوك', 'Diet & Behavior', 'Alimentation et comportement'),
            body: diet
        });
    }

    sections.forEach(section => {
        const block = document.createElement('div');
        block.className = 'geology-detail-block Zoology-detail-block';
        block.innerHTML = `
            <h3 class="section-title">${section.title}</h3>
            <div class="description-text">${section.body.replace(/\n/g, '<br>')}</div>
        `;
        container.appendChild(block);
    });
}

function initGeologyGallery(root, urls) {
    if (!root || !urls.length) return;
    let index = 0;
    const img = root.querySelector('.gallery-track-img');
    const dotsWrap = root.parentElement.querySelector('.gallery-dots');
    const prevBtn = root.querySelector('.gallery-prev');
    const nextBtn = root.querySelector('.gallery-next');

    const renderDots = () => {
        if (!dotsWrap) return;
        dotsWrap.innerHTML = urls.map((_, i) =>
            `<span class="gallery-dot${i === index ? ' active' : ''}" data-idx="${i}"></span>`
        ).join('');
        dotsWrap.querySelectorAll('.gallery-dot').forEach(dot => {
            dot.onclick = () => {
                index = Number(dot.dataset.idx);
                img.src = urls[index];
                renderDots();
            };
        });
    };

    const show = (delta) => {
        index = (index + delta + urls.length) % urls.length;
        img.src = urls[index];
        renderDots();
    };

    if (prevBtn) prevBtn.onclick = () => show(-1);
    if (nextBtn) nextBtn.onclick = () => show(1);
    renderDots();
    urls.slice(1).forEach(url => preloadImageUrl(url));
}

// Helpers
function resolveCollectionId(collectionId) {
    if (!collectionId) return collectionId;
    const id = collectionId.toLowerCase();
    if (id.includes('tourism')) return AppwriteConfig.collections.tourism;
    if (id.includes('zoology')) return AppwriteConfig.collections.zoology;
    if (id.includes('sceience_museum_geo') || id.includes('geology')) return AppwriteConfig.collections.geology;
    if (id.includes('science')) return AppwriteConfig.collections.science;
    if (id.includes('art')) return AppwriteConfig.collections.art;
    return collectionId;
}

const SCIENCE_SUBMUSEUM_FILTERS = {
    zoology: ['zoology', 'zoologie', 'علم الحيوان', 'حيوان', 'حيوانات'],
    biology: ['biology', 'biologie', 'البيولوجيا', 'بيولوج', 'بيولوجيا'],
    geology: ['geology', 'geologie', 'الجيولوجيا', 'جيولوج', 'معادن', 'صخور']
};

function matchesScienceSubMuseum(doc, subMuseumId) {
    const cat = (doc['category-ar'] || doc.category || doc.category_ar || doc['category-en'] || '').toLowerCase();
    const sub = (doc.sub_museum || doc.subMuseum || '').toLowerCase();
    const keywords = SCIENCE_SUBMUSEUM_FILTERS[subMuseumId] || [subMuseumId];
    return keywords.some(kw => cat.includes(kw.toLowerCase()) || sub.includes(kw.toLowerCase()));
}

function getBucketByType(collectionId) {
    if (!collectionId) return AppwriteConfig.buckets.tourism;
    if (isZoologyCollection(collectionId)) return AppwriteConfig.buckets.zoologyImages;
    if (isGeologyCollection(collectionId)) return AppwriteConfig.buckets.geoImages;
    if (collectionId.includes('science')) return AppwriteConfig.buckets.scienceImages;
    if (collectionId.includes('art')) return AppwriteConfig.buckets.artImages;
    return AppwriteConfig.buckets.tourism;
}

function getStorageBucketsForCollection(collectionId) {
    const buckets = [];
    if (collectionId?.includes('tourism')) buckets.push(AppwriteConfig.buckets.tourism);
    if (isZoologyCollection(collectionId)) buckets.push(AppwriteConfig.buckets.zoologyImages);
    if (isGeologyCollection(collectionId)) buckets.push(AppwriteConfig.buckets.geoImages);
    if (collectionId?.includes('science')) buckets.push(AppwriteConfig.buckets.scienceImages);
    if (collectionId?.includes('art')) buckets.push(AppwriteConfig.buckets.artImages);
    buckets.push(
        AppwriteConfig.buckets.arModels,
        AppwriteConfig.buckets.tourism,
        AppwriteConfig.buckets.artifacts,
        AppwriteConfig.buckets.artImages,
        AppwriteConfig.buckets.scienceImages,
        AppwriteConfig.buckets.geoImages,
        AppwriteConfig.buckets.zoologyImages
    );
    return [...new Set(buckets.filter(Boolean))];
}

function getAppwriteImageUrl(fileId, bucketId) {
    if (!fileId) return '';
    if (Array.isArray(fileId)) fileId = fileId[0];
    if (typeof fileId === 'string' && (fileId.startsWith('http') || fileId.startsWith('assets/'))) {
        return fileId;
    }
    fileId = fileId.toString().trim();
    // Use 'view' for audio files, PDFs, and 3D GLB models
    const isViewableType = bucketId === AppwriteConfig.buckets.audio || 
                           bucketId === AppwriteConfig.buckets.arModels || 
                           fileId.toLowerCase().endsWith('.glb') || 
                           fileId.toLowerCase().endsWith('.pdf');
    const action = isViewableType ? 'view' : 'preview';
    return `${AppwriteConfig.endpoint}/storage/buckets/${bucketId}/files/${fileId}/${action}?project=${AppwriteConfig.projectId}`;
}

function getAppwriteStorageUrl(fileId, bucketId, action) {
    if (!fileId) return '';
    if (Array.isArray(fileId)) fileId = fileId[0];
    if (typeof fileId === 'string' && (fileId.startsWith('http') || fileId.startsWith('assets/'))) {
        return fileId;
    }
    return `${AppwriteConfig.endpoint}/storage/buckets/${bucketId}/files/${fileId.toString().trim()}/${action}?project=${AppwriteConfig.projectId}`;
}

function resolveGlbModelUrls(fileId, collectionId) {
    if (!fileId) return [];
    if (typeof fileId === 'string' && fileId.startsWith('http')) return [fileId];

    const primaryBucket = AppwriteConfig.buckets.arModels;
    const urls = [];

    for (const action of ['view', 'download']) {
        const url = getAppwriteStorageUrl(fileId, primaryBucket, action);
        if (url && !urls.includes(url)) urls.push(url);
    }

    const buckets = getStorageBucketsForCollection(collectionId);
    for (const bucket of buckets) {
        if (bucket === primaryBucket) continue;
        for (const action of ['view', 'download']) {
            const url = getAppwriteStorageUrl(fileId, bucket, action);
            if (url && !urls.includes(url)) urls.push(url);
        }
    }

    return urls.length ? urls : [getAppwriteStorageUrl(fileId, primaryBucket, 'download')];
}

function setupImageFallback(imgEl, fileId) {
    if (!imgEl) return;
    if (!fileId) {
        imgEl.style.display = 'none';
        const card = imgEl.closest('.artifact-card');
        if (card) card.classList.add('no-image');
        return;
    }
    const buckets = [
        AppwriteConfig.buckets.zoologyImages,
        AppwriteConfig.buckets.geoImages,
        AppwriteConfig.buckets.artifacts,
        AppwriteConfig.buckets.tourism,
        AppwriteConfig.buckets.artImages,
        AppwriteConfig.buckets.artImages2,
        AppwriteConfig.buckets.artImages3,
        AppwriteConfig.buckets.artImages4,
        AppwriteConfig.buckets.scienceImages
    ];
    let currentIdx = 0;
    imgEl.onerror = () => {
        if (currentIdx < buckets.length) {
            imgEl.src = getAppwriteImageUrl(fileId, buckets[currentIdx++]);
        } else {
            imgEl.style.display = 'none';
            const card = imgEl.closest('.artifact-card');
            if (card) card.classList.add('no-image');
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
                <div class="mobile-info-card" style="background: rgba(0,0,0,0.05); padding: 30px; border-radius: 20px;">
                    <h3 class="text-dark">لا توجد نتائج للبحث.</h3>
                    <p class="text-secondary">جرب البحث بكلمات أخرى</p>
                </div>
            </div>
        `;
        return;
    }

    if (isGeologyCollection(currentMuseumCollection)) {
        renderZoologyGeologyList(artifacts, false);
        return;
    }
    if (isZoologyCollection(currentMuseumCollection)) {
        renderZoologyGeologyList(artifacts, true);
        return;
    }

    const fragment = document.createDocumentFragment();

    artifacts.forEach((artifact) => {
        const bucketId = resolveArtifactImageBucket(artifact, getBucketByType(currentMuseumCollection));
        const imageUrl = getAppwriteImageUrl(artifact.image || artifact.image_url, bucketId);
        const artifactId = artifact.$id || artifact.id || '';
        let artifactTitle = getArtifactTitle(artifact);
        
        let subtitle = '';
        const lang = getCurrentLang();
        if (currentMuseumCollection.includes('tourism')) {
            subtitle = artifact[`era-${lang}`] || artifact['era-ar'] || artifact.era || '';
        } else if (currentMuseumCollection.includes('art_')) {
            const author = artifact[`author-${lang}`] || artifact['author-ar'] || artifact.author || (lang === 'en' ? 'Unknown Artist' : (lang === 'fr' ? 'Artiste inconnu' : 'فنان غير معروف'));
            const serial = artifact.serial_number ? `#${artifact.serial_number}` : '';
            artifactTitle = author;
            subtitle = serial;
        } else if (currentMuseumCollection.includes('science')) {
            subtitle = artifact[`category-${lang}`] || artifact['category-ar'] || artifact.category || '';
        }

        const artifactLink = `artifact.html?id=${encodeURIComponent(artifactId)}&collection=${encodeURIComponent(currentMuseumCollection)}&museum=${encodeURIComponent(currentMuseumName)}`;

        const col = document.createElement('div');
        col.className = 'col-lg-3 col-md-4 col-6 mb-4';

        const glbFileId = artifact.glbFileId || artifact.glbFileld || artifact.glb_file_id || '';
        const btn360Html = (glbFileId && glbFileId.trim().length > 5) ? `
            <button class="btn-3d-badge" onclick="event.preventDefault(); window.location.href='${artifactLink}&show3d=true'">
                <i class="fas fa-cube"></i> <span>3D</span>
            </button>
        ` : '';

        col.innerHTML = `
            <a href="${artifactLink}" class="artifact-card-link" style="text-decoration:none;">
                <div class="artifact-card position-relative">
                    ${btn360Html}
                    <div class="artifact-card-img">
                        <img src="${imageUrl}" alt="${artifactTitle}" loading="eager" fetchpriority="high">
                    </div>
                    <div class="artifact-card-overlay"></div>
                    <div class="artifact-card-body">
                        <h3 class="artifact-card-title">${artifactTitle}</h3>
                        <p class="artifact-card-subtitle">${subtitle}</p>
                    </div>
                </div>
            </a>
        `;

        // Smart On-Demand Preloading (Hover/Touch)
        const triggerPreload = () => {
            if (glbFileId && glbFileId.trim().length > 5) {
                preloadGlbModel(glbFileId, currentMuseumCollection);
            }
            const audioFileId = artifact[`audio_guide_${lang}`] || artifact[`audio_guide-${lang}`] ||
                artifact[`audio-${lang}`] || artifact[`audio_${lang}`] || artifact['audio-ar'] || artifact.audio_ar || '';
            if (audioFileId && audioFileId.trim().length > 5) {
                const audioBucketId = AppwriteConfig.buckets.audio;
                const audioUrl = getAppwriteImageUrl(audioFileId, audioBucketId);
                fetch(audioUrl, { method: 'GET', cache: 'force-cache', mode: 'cors' }).catch(() => {});
            }
        };
        col.addEventListener('mouseenter', triggerPreload, { once: true });
        col.addEventListener('touchstart', triggerPreload, { passive: true, once: true });

        fragment.appendChild(col);
        const img = col.querySelector('img');
        setupImageFallback(img, artifact.image || artifact.image_url);
    });

    artifactsGrid.appendChild(fragment);
};

const renderZoologyGeologyList = (artifacts, isZoology) => {
    const artifactsGrid = document.getElementById('artifacts-grid');
    if (!artifactsGrid) return;

    artifactsGrid.innerHTML = '';
    const fragment = document.createDocumentFragment();
    const lang = getCurrentLang();
    const bucketId = isZoology ? AppwriteConfig.buckets.zoologyImages : AppwriteConfig.buckets.geoImages;
    const colId = isZoology ? AppwriteConfig.collections.zoology : AppwriteConfig.collections.geology;

    artifacts.forEach((artifact) => {
        const imageUrl = getAppwriteImageUrl(artifact.image || artifact.image_url, bucketId);
        const artifactId = artifact.$id || artifact.id || '';
        const artifactTitle = getArtifactTitle(artifact);
        const artifactLink = `artifact.html?id=${encodeURIComponent(artifactId)}&collection=${encodeURIComponent(colId)}&museum=${encodeURIComponent(currentMuseumName)}`;

        const col = document.createElement('div');
        col.className = 'col-lg-3 col-md-4 col-6 mb-4';
        
        col.innerHTML = `
            <a href="${artifactLink}" class="zoology-geology-card-link" style="text-decoration:none;">
                <div class="zoology-geology-card">
                    <div class="zoology-geology-card-img">
                        <img src="${imageUrl}" alt="${artifactTitle}" loading="eager" decoding="async" fetchpriority="high">
                    </div>
                    <div class="zoology-geology-card-body">
                        <h3 class="zoology-geology-card-title">${artifactTitle}</h3>
                    </div>
                </div>
            </a>
        `;

        // Smart On-Demand Preloading
        const triggerPreload = () => {
            const glbFileId = artifact.glbFileId || artifact.glbFileld || artifact.glb_file_id || '';
            if (glbFileId && glbFileId.trim().length > 5) {
                preloadGlbModel(glbFileId, colId);
            }
            const audioFileId = artifact[`audio_guide_${lang}`] || artifact[`audio_guide-${lang}`] ||
                artifact[`audio-${lang}`] || artifact[`audio_${lang}`] || artifact['audio-ar'] || artifact.audio_ar || '';
            if (audioFileId && audioFileId.trim().length > 5) {
                const audioBucketId = AppwriteConfig.buckets.audio;
                const audioUrl = getAppwriteImageUrl(audioFileId, audioBucketId);
                fetch(audioUrl, { method: 'GET', cache: 'force-cache', mode: 'cors' }).catch(() => {});
            }
        };
        col.addEventListener('mouseenter', triggerPreload, { once: true });
        col.addEventListener('touchstart', triggerPreload, { passive: true, once: true });

        fragment.appendChild(col);
        const img = col.querySelector('img');
        if (img) {
            setupImageFallback(img, artifact.image || artifact.image_url);
        }
    });

    artifactsGrid.appendChild(fragment);
};

// Global Page Initializers
window.initMuseumPage = async (collectionId, museumName, museumImg) => {
    const artifactsGrid = document.getElementById('artifacts-grid');
    const museumTitleHero = document.getElementById('museum-title-hero');
    const museumHeroImg = document.getElementById('museum-hero-img');

    if (!artifactsGrid) return;

    if (!databases) initAppwrite();
    if (!databases) {
        artifactsGrid.innerHTML = `<div class="col-12 text-center py-5"><h3 class="text-dark">جاري تحميل البيانات...</h3></div>`;
        await new Promise(r => setTimeout(r, 500));
        if (!databases) initAppwrite();
    }
    
    collectionId = resolveCollectionId(collectionId);
    currentMuseumCollection = collectionId;
    currentMuseumName = museumName;
    museumArtifactsCache = [];

    if (museumTitleHero) {
        const lang = getCurrentLang();
        let titleKey = '';
        if (collectionId.includes('tourism')) titleKey = 'tourism_title';
        else if (collectionId.includes('art')) titleKey = 'art_title';
        else if (collectionId.includes('science')) titleKey = 'science_title';
        
        try {
            const trans = typeof translations !== 'undefined' ? translations : (window.translations || null);
            if (titleKey && trans && trans[lang] && trans[lang][titleKey]) {
                museumTitleHero.innerText = trans[lang][titleKey];
            } else {
                museumTitleHero.innerText = museumName;
            }
        } catch (e) {
            museumTitleHero.innerText = museumName;
        }
    }
    
    // Set Hero Image
    if (museumHeroImg) {
        if (museumImg && museumImg !== 'null' && museumImg !== 'undefined') {
            museumHeroImg.src = museumImg;
        } else {
            // Fallback sync logic
            if (collectionId.includes('tourism')) museumHeroImg.src = 'assets/tourism-museum.jpg';
            else if (collectionId.includes('art_')) museumHeroImg.src = 'assets/artt-museum.jpg';
            else if (collectionId.includes('science')) museumHeroImg.src = 'assets/متاحف كلية علوم.png';
        }
    }

    if (collectionId.includes('science')) {
        renderScienceMuseums();
        return;
    }

    try {
        const queries = Query ? [Query.limit(100)] : [];
        const response = await databases.listDocuments(AppwriteConfig.databaseId, collectionId, queries);
        museumArtifactsCache = response.documents || [];
        
        preloadArtifactsFromCache(museumArtifactsCache, collectionId);
        
        if (!museumArtifactsCache.length && !collectionId.includes('art_')) {
            artifactsGrid.innerHTML = `
                <div class="col-12 text-center py-5">
                    <h3 class="text-dark">لا توجد قطع أثرية متاحة حالياً في هذا المتحف.</h3>
                </div>
            `;
            return;
        }

        // Add back button container if not exists
        let backToHallsBtn = document.getElementById('back-to-halls-btn');
        if (!backToHallsBtn) {
            backToHallsBtn = document.createElement('div');
            backToHallsBtn.id = 'back-to-halls-btn';
            backToHallsBtn.className = 'text-center mb-4';
            backToHallsBtn.style.display = 'none';
            artifactsGrid.parentNode.insertBefore(backToHallsBtn, artifactsGrid);
        }

        if (collectionId.includes('art_')) {
            renderArtHalls();
        } else {
            renderArtifacts(museumArtifactsCache);
        }
    } catch (error) {
        console.error('Error fetching artifacts:', error);
        artifactsGrid.innerHTML = `<div class="col-12 text-center py-5"><h3 class="text-danger">حدث خطأ أثناء تحميل البيانات.</h3></div>`;
    }
};

window.renderArtHalls = () => {
    const artifactsGrid = document.getElementById('artifacts-grid');
    const backToHallsBtn = document.getElementById('back-to-halls-btn');
    if (!artifactsGrid) return;
    
    if (backToHallsBtn) backToHallsBtn.style.display = 'none';
    
    const lang = getCurrentLang();
    artifactsGrid.innerHTML = '';
    const fragment = document.createDocumentFragment();

    const halls = [
        { id: 1, color: '#422006', ar: 'القاعة الأولى', en: 'First Hall', fr: 'Première Salle' },
        { id: 2, color: '#0D1B2A', ar: 'القاعة الثانية', en: 'Second Hall', fr: 'Deuxième Salle' },
        { id: 3, color: '#2E4053', ar: 'القاعة الثالثة', en: 'Third Hall', fr: 'Troisième Salle' },
        { id: 4, color: '#5D4037', ar: 'القاعة الرابعة', en: 'Fourth Hall', fr: 'Quatrième Salle' }
    ];

    halls.forEach(hall => {
        const title = hall[lang] || hall.ar;
        const col = document.createElement('div');
        col.className = 'col-12 mb-3';
        
        col.innerHTML = `
            <a href="javascript:void(0)" onclick="filterArtByHall(${hall.id}, '${title}')" class="hall-card-link">
                <div class="hall-card" style="background: linear-gradient(180deg, ${hall.color}cc 0%, ${hall.color} 100%);">
                    <h3>${title}</h3>
                </div>
            </a>
        `;
        fragment.appendChild(col);
    });

    artifactsGrid.appendChild(fragment);
};

window.renderScienceMuseums = () => {
    currentScienceSubMuseumId = null;
    const artifactsGrid = document.getElementById('artifacts-grid');
    const backToHallsBtn = document.getElementById('back-to-halls-btn');
    if (!artifactsGrid) return;
    
    if (backToHallsBtn) backToHallsBtn.style.display = 'none';
    
    const lang = getCurrentLang();
    artifactsGrid.innerHTML = '';
    const fragment = document.createDocumentFragment();

    // Match mobile app: Geological Museum (active) + Zoology Museum (coming soon)
    const museums = [
        {
            id: 'geology',
            img: 'assets/science-museum1.png',
            ar: 'المتحف الجيولوجي',
            en: 'Geological Museum',
            fr: 'Musée Géologique',
            active: true
        },
        {
            id: 'zoology',
            img: 'assets/science-museum.png',
            ar: 'متحف علم الحيوان',
            en: 'Zoology Museum',
            fr: 'Musée de Zoologie',
            active: true
        }
    ];

    museums.forEach(museum => {
        const title = museum[lang] || museum.ar;
        const col = document.createElement('div');
        col.className = 'col-12 mb-3';

        const onClick = museum.active
            ? `loadScienceSubMuseum('${museum.id}', '${title.replace(/'/g, "\\'")}')`
            : `showZoologyComingSoon()`;

        // In RTL (Arabic): outward arrow = chevron-left (points left on screen = outward)
        // In LTR (English/French): outward arrow = chevron-right (points right on screen = outward)
        const arrowIcon = lang === 'ar' ? 'fa-chevron-left' : 'fa-chevron-right';

        col.innerHTML = `
            <div class="geology-list-card science-sub-card" onclick="${onClick}" role="button" tabindex="0">
                <img src="${museum.img}" alt="${title}" loading="eager" onerror="this.src='assets/science-museum.png'">
                <div class="geology-list-overlay"></div>
                <div class="geology-list-title">${title}</div>
                <div class="geology-list-arrow"><i class="fas ${arrowIcon}"></i></div>
            </div>
        `;
        fragment.appendChild(col);
    });

    artifactsGrid.appendChild(fragment);
    preloadAllMuseumAssets();
};

window.showZoologyComingSoon = () => {
    const lang = getCurrentLang();
    const msg = lang === 'en'
        ? 'Zoology Museum will be activated soon'
        : (lang === 'fr' ? 'Le musée de zoologie sera bientôt disponible' : 'متحف علم الحيوان سيتم تفعيله قريباً');
    if (typeof showToast === 'function') {
        showToast(msg, 'info');
    } else {
        alert(msg);
    }
};

// Load science sub-museum artifacts from Appwrite DB
window.loadScienceSubMuseum = async (subMuseumId, subMuseumTitle) => {
    currentScienceSubMuseumId = subMuseumId;
    if (!databases) initAppwrite();

    const artifactsGrid = document.getElementById('artifacts-grid');
    const backToHallsBtn = document.getElementById('back-to-halls-btn');
    const lang = getCurrentLang();
    const backArrow = lang === 'ar' ? 'right' : 'left';

    const backBtnText = lang === 'en' ? 'Back to Museums' : (lang === 'fr' ? 'Retour aux Musées' : 'العودة للمتاحف');
    if (backToHallsBtn) {
        backToHallsBtn.innerHTML = `
            <button class="btn-back-museum" onclick="renderScienceMuseums()">
                <i class="fas fa-arrow-${backArrow} me-2"></i> ${backBtnText}
            </button>
            <h3 class="submuseum-title">${subMuseumTitle}</h3>
        `;
        backToHallsBtn.style.display = 'block';
    }

    artifactsGrid.innerHTML = `
        <div class="col-12 text-center py-5">
            <i class="fas fa-spinner fa-spin fa-3x" style="color: #422006;"></i>
            <p class="text-muted mt-3">${lang === 'en' ? 'Loading...' : (lang === 'fr' ? 'Chargement...' : 'جاري التحميل...')}</p>
        </div>
    `;

    try {
        let docs = [];

        if (subMuseumId === 'geology') {
            currentMuseumCollection = AppwriteConfig.collections.geology;
            const queries = Query ? [Query.limit(100)] : [];
            const response = await databases.listDocuments(
                AppwriteConfig.databaseId,
                AppwriteConfig.collections.geology,
                queries
            );
            docs = response.documents || [];
        } else if (subMuseumId === 'zoology') {
            currentMuseumCollection = AppwriteConfig.collections.zoology;
            const queries = Query ? [Query.limit(100)] : [];
            const response = await databases.listDocuments(
                AppwriteConfig.databaseId,
                AppwriteConfig.collections.zoology,
                queries
            );
            docs = response.documents || [];
        } else {
            currentMuseumCollection = AppwriteConfig.collections.science;
            const queries = Query ? [Query.limit(100)] : [];
            const response = await databases.listDocuments(
                AppwriteConfig.databaseId,
                AppwriteConfig.collections.science,
                queries
            );
            docs = response.documents || [];

            if (subMuseumId !== 'all') {
                const filtered = docs.filter(d => matchesScienceSubMuseum(d, subMuseumId));
                if (filtered.length > 0) docs = filtered;
            }
        }

        museumArtifactsCache = docs;

        if (!docs.length) {
            artifactsGrid.innerHTML = `
                <div class="col-12 text-center py-5">
                    <i class="fas fa-box-open fa-3x text-warning mb-4"></i>
                    <h3 class="text-dark">${lang === 'en' ? 'No items found yet.' : (lang === 'fr' ? 'Aucune pièce trouvée.' : 'لا توجد قطع متاحة حالياً.')}</h3>
                </div>
            `;
            return;
        }

        preloadArtifactsFromCache(docs, currentMuseumCollection);
        renderArtifacts(docs);
    } catch (err) {
        console.error('Error loading science sub-museum:', err);
        artifactsGrid.innerHTML = `
            <div class="col-12 text-center py-5">
                <i class="fas fa-exclamation-triangle fa-3x text-danger mb-4"></i>
                <h3 class="text-dark">${lang === 'en' ? 'Failed to load data.' : (lang === 'fr' ? 'Échec du chargement.' : 'حدث خطأ أثناء تحميل البيانات.')}</h3>
            </div>
        `;
    }
};

// Keep showScienceComingSoon as fallback (not used for science but kept for safety)
window.showScienceComingSoon = (museumTitle) => {
    const artifactsGrid = document.getElementById('artifacts-grid');
    const lang = getCurrentLang();
    artifactsGrid.innerHTML = `
        <div class="col-12 text-center py-5">
            <div style="background: rgba(0,0,0,0.05); padding: 50px 30px; border-radius: 20px;">
                <i class="fas fa-tools text-warning mb-4" style="font-size: 4rem;"></i>
                <h2 class="text-dark mb-3" style="font-weight: bold;">${lang === 'en' ? 'Coming Soon' : (lang === 'fr' ? 'Bientôt disponible' : 'قريباً')}</h2>
            </div>
        </div>
    `;
};

window.filterArtByHall = (hallId, hallTitle) => {
    const lang = getCurrentLang();
    const filtered = museumArtifactsCache.filter(a => {
        const artIdVal = a['art-id'] || a.art_id || a.artId;
        return String(artIdVal) === String(hallId);
    });
    
    const backBtnText = lang === 'en' ? 'Back to Halls' : (lang === 'fr' ? 'Retour aux Salles' : 'العودة للقاعات');
    const backToHallsBtn = document.getElementById('back-to-halls-btn');
    if (backToHallsBtn) {
        backToHallsBtn.innerHTML = `
            <button class="btn-back-museum" onclick="renderArtHalls()">
                <i class="fas fa-arrow-${lang === 'ar' ? 'right' : 'left'} me-2"></i> ${backBtnText}
            </button>
            <h3 class="submuseum-title">${hallTitle}</h3>
        `;
        backToHallsBtn.style.display = 'block';
    }
    
    if (!filtered.length) {
        const artifactsGrid = document.getElementById('artifacts-grid');
        
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + 2);
        
        const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
        const formattedDate = targetDate.toLocaleDateString(
            lang === 'en' ? 'en-US' : (lang === 'fr' ? 'fr-FR' : 'ar-EG'), 
            dateOptions
        );

        const soonMsg = lang === 'en' ? `The museum pieces will be available soon by ${formattedDate}` : 
                        (lang === 'fr' ? `Les pièces du musée seront bientôt disponibles d'ici le ${formattedDate}` : 
                        `سيتم توفير قطع القاعة قريباً بحلول ${formattedDate}`);

        artifactsGrid.innerHTML = `
            <div class="col-12 text-center py-5">
                <div class="mobile-info-card" style="background: rgba(0,0,0,0.05); padding: 50px 30px; border-radius: 20px;">
                    <i class="fas fa-tools text-warning mb-4" style="font-size: 4rem;"></i>
                    <h2 class="text-dark mb-3" style="font-weight: bold;">${soonMsg}</h2>
                    <p class="text-secondary">${lang === 'en' ? 'We are working hard to add pieces to this hall.' : (lang === 'fr' ? 'Nous travaillons dur pour ajouter des pièces à cette salle.' : 'نعمل بجد لإضافة القطع الخاصة بهذه القاعة لتجربة مميزة.')}</p>
                </div>
            </div>
        `;
    } else {
        renderArtifacts(filtered);
    }
};

window.initArtifactPage = async (documentId, collectionId, museumName) => {
    collectionId = resolveCollectionId(collectionId);
    if (!databases) initAppwrite();

    const loader = document.getElementById('loader');
    const artifactContent = document.getElementById('artifact-content');
    const artifactDesc = document.getElementById('artifact-desc');
    const audioSection = document.getElementById('audio-section');
    const audioPlayer = document.getElementById('artifact-audio');
    const artifactImg = document.getElementById('artifact-img');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const audioProgress = document.getElementById('audio-progress');
    const currentTimeEl = document.getElementById('current-time');
    const durationTimeEl = document.getElementById('duration-time');
    const artifactNameHero = document.getElementById('artifact-name-hero');
    const artifactSubtitleHero = document.getElementById('artifact-subtitle-hero');
    const infoGrid = document.getElementById('info-grid');

    if (loader) {
        loader.style.display = 'block';
        const loaderText = loader.querySelector('p');
        if (loaderText) {
            const lang = getCurrentLang();
            loaderText.innerText = lang === 'en' ? 'Summoning history...' : (lang === 'fr' ? 'Évocation de l\'histoire...' : 'جاري استحضار التاريخ...');
        }
    }
    if (artifactContent) artifactContent.style.display = 'none';

    try {
        let artifact = await databases.getDocument(AppwriteConfig.databaseId, collectionId, documentId);
        const lang = getCurrentLang();
        
        let name = getArtifactTitle(artifact);
        let subtitle = '';

        if (collectionId.includes('tourism')) {
            subtitle = artifact[`era-${lang}`] || artifact['era-ar'] || artifact.era || (lang === 'en' ? 'Unspecified Era' : (lang === 'fr' ? 'Époque non spécifiée' : 'عصر غير محدد'));
        } else if (collectionId.includes('art_')) {
            const hallName = artifact[`nameh-${lang}`] || artifact['nameh-ar'] || artifact.nameh || (lang === 'en' ? `Hall ${artifact['art-id']}` : `القاعة ${artifact['art-id']}`);
            const author = artifact[`author-${lang}`] || artifact['author-ar'] || artifact.author || (lang === 'en' ? 'Unknown Artist' : (lang === 'fr' ? 'Artiste inconnu' : 'فنان غير معروف'));
            name = hallName;
            subtitle = author;
        } else if (collectionId.includes('science')) {
            subtitle = artifact[`category-${lang}`] || artifact['category-ar'] || artifact.category || (lang === 'en' ? 'Scientific Category' : (lang === 'fr' ? 'Catégorie scientifique' : 'تصنيف علمي'));
        } else if (isGeologyCollection(collectionId)) {
            subtitle = artifact[`Classification-${lang}`] || artifact[`classification-${lang}`] ||
                       artifact['Classification-ar'] || artifact['classification-ar'] || (lang === 'en' ? 'Geology' : (lang === 'fr' ? 'Géologie' : 'جيولوجيا'));
        } else if (isZoologyCollection(collectionId)) {
            subtitle = artifact['scientific-name'] || artifact.scientific_name || (lang === 'en' ? 'Zoology' : (lang === 'fr' ? 'Zoologie' : 'علم الحيوان'));
        }
        
        if (artifactNameHero) artifactNameHero.innerText = name;
        if (artifactSubtitleHero) artifactSubtitleHero.innerText = subtitle;

        const bucketId = resolveArtifactImageBucket(artifact, getBucketByType(collectionId));
        const imgUrl = getAppwriteImageUrl(artifact.image || artifact.image_url, bucketId);
        preloadImageUrl(imgUrl);
        getArtifactGalleryUrls(artifact, bucketId, collectionId).forEach(preloadImageUrl);
        if (artifactImg) {
            artifactImg.src = imgUrl;
            setupImageFallback(artifactImg, artifact.image || artifact.image_url);
        }

        const emptyDesc = lang === 'en' ? 'No description available.' : (lang === 'fr' ? 'Aucune description disponible.' : 'لا يوجد وصف متاح.');
        if (artifactDesc) artifactDesc.innerText = getArtifactDescription(artifact) || emptyDesc;

        // Translate section titles if they exist
        const sectionTitles = document.querySelectorAll('.section-title');
        if (sectionTitles.length >= 2) {
            if (collectionId.includes('tourism')) {
                sectionTitles[0].innerText = lang === 'en' ? 'Artifact Details' : (lang === 'fr' ? 'Détails de l\'artefact' : 'تفاصيل الأثر');
            } else if (collectionId.includes('art_')) {
                sectionTitles[0].innerText = lang === 'en' ? 'Painting Details' : (lang === 'fr' ? 'Détails du tableau' : 'تفاصيل اللوحة');
            } else if (isGeologyCollection(collectionId)) {
                sectionTitles[0].innerText = lang === 'en' ? 'Information Card' : (lang === 'fr' ? 'Fiche d\'information' : 'بطاقة المعلومات');
            } else if (isZoologyCollection(collectionId)) {
                sectionTitles[0].innerText = lang === 'en' ? 'Basic Information' : (lang === 'fr' ? 'Informations de base' : 'المعلومات الأساسية');
            } else {
                sectionTitles[0].innerText = lang === 'en' ? 'Identification Card' : (lang === 'fr' ? 'Carte d\'identité' : 'بطاقة التعريف');
            }

            if (isGeologyCollection(collectionId)) {
                sectionTitles[1].innerText = lang === 'en' ? 'Quick Summary' : (lang === 'fr' ? 'Résumé rapide' : 'نبذة سريعة');
            } else {
                sectionTitles[1].innerText = lang === 'en' ? 'Description' : (lang === 'fr' ? 'Description' : 'الوصف');
            }
        }
        const audioTitle = document.querySelector('#audio-section h3');
        if (audioTitle) {
            audioTitle.innerText = lang === 'en' ? 'Listen to Audio Description' : (lang === 'fr' ? 'Écouter la description audio' : 'استمع الي الوصف الصوتي');
        }

        // Translations for labels based on language
        // Translations for labels based on language
        // Translations for labels based on language
        const labels = {
            ar: { museum: 'المتحف', category: 'التصنيف', era: 'العصر', location: 'مكان الاكتشاف', material: 'المادة', dimensions: 'الأبعاد', author: 'الفنان', serial: 'الرقم التسلسلي', size: 'المقاسات', type: 'الخامة / النوع', hall: 'القاعة' },
            en: { museum: 'Museum', category: 'Category', era: 'Era', location: 'Provenance', material: 'Material', dimensions: 'Dimensions', author: 'Artist', serial: 'Serial Number', size: 'Size', type: 'Type', hall: 'Hall' },
            fr: { museum: 'Musée', category: 'Catégorie', era: 'Époque', location: 'Provenance', material: 'Matériel', dimensions: 'Dimensions', author: 'Artiste', serial: 'Numéro de série', size: 'Taille', type: 'Type', hall: 'Salle' }
        };
        const l = labels[lang] || labels.ar;

        // Populate Info Grid
        if (infoGrid) {
            infoGrid.innerHTML = '';
            
            if (isZoologyCollection(collectionId)) {
                infoGrid.style.display = 'block'; // Clear grid layout for custom cards
                
                let basicInfoHtml = `
                    <div class="zoology-detail-card">
                        <div class="zoology-detail-row">
                            <div class="zoology-detail-icon"><i class="fas fa-info-circle"></i></div>
                            <div class="zoology-detail-content">
                                <span class="zoology-detail-label">${lang === 'en' ? 'Name' : (lang === 'fr' ? 'Nom' : 'الاسم')}:</span>
                                <span class="zoology-detail-value">${getArtifactTitle(artifact)}</span>
                            </div>
                        </div>
                `;
                
                const sciName = artifact['scientific-name'] || artifact.scientific_name || '';
                if (sciName && sciName.toLowerCase() !== 'null' && sciName.trim() !== '') {
                    basicInfoHtml += `
                        <div class="zoology-detail-divider"></div>
                        <div class="zoology-detail-row">
                            <div class="zoology-detail-icon"><i class="fas fa-microscope"></i></div>
                            <div class="zoology-detail-content">
                                <span class="zoology-detail-label">${lang === 'en' ? 'Scientific Name' : (lang === 'fr' ? 'Nom scientifique' : 'الاسم العلمي')}:</span>
                                <span class="zoology-detail-value scientific">${sciName}</span>
                            </div>
                        </div>
                    `;
                }
                basicInfoHtml += `</div>`;
                infoGrid.innerHTML = basicInfoHtml;

                // Scientific Classification
                const classificationTitleText = lang === 'en' ? 'Scientific Classification' : (lang === 'fr' ? 'Classification scientifique' : 'التصنيف العلمي');
                
                let classCardHtml = `
                    <h3 class="section-title">${classificationTitleText}</h3>
                    <div class="zoology-detail-card">
                `;
                
                const classFields = [
                    { key: 'phylum', icon: 'fas fa-project-diagram', ar: 'الشعبة', en: 'Phylum', fr: 'Phylum' },
                    { key: 'subphylum', icon: 'fas fa-sitemap', ar: 'الشعيبة', en: 'Subphylum', fr: 'Sous-phylum' },
                    { key: 'superclass', icon: 'fas fa-th-large', ar: 'فوق طائفة', en: 'Superclass', fr: 'Super-classe' },
                    { key: 'class', icon: 'fas fa-tags', ar: 'الطائفة', en: 'Class', fr: 'Classe' },
                    { key: 'subclass', icon: 'fas fa-th', ar: 'الطويئفة', en: 'Subclass', fr: 'Sous-classe' },
                    { key: 'order', icon: 'fas fa-list-ul', ar: 'الرتبة', en: 'Order', fr: 'Ordre' },
                    { key: 'family', icon: 'fas fa-users-cog', ar: 'الفصيلة', en: 'Family', fr: 'Famille' }
                ];
                
                let addedAnyClassField = false;
                classFields.forEach((f) => {
                    let val = artifact[f.key] || '';
                    if (f.key === 'class') {
                        val = artifact['class'] || artifact['classVal'] || '';
                    }
                    if (f.key === 'superclass') {
                        val = artifact['superclass'] || artifact['super_class'] || artifact['super-class'] || '';
                    }
                    
                    if (val && val.toLowerCase() !== 'null' && val.trim() !== '' && val.trim() !== 'N/A' && val.trim() !== '-') {
                        if (addedAnyClassField) {
                            classCardHtml += `<div class="zoology-detail-divider"></div>`;
                        }
                        const labelText = lang === 'en' ? f.en : (lang === 'fr' ? f.fr : f.ar);
                        classCardHtml += `
                            <div class="zoology-detail-row">
                                <div class="zoology-detail-icon"><i class="${f.icon}"></i></div>
                                <div class="zoology-detail-content">
                                    <span class="zoology-detail-label">${labelText}:</span>
                                    <span class="zoology-detail-value">${val}</span>
                                </div>
                            </div>
                        `;
                        addedAnyClassField = true;
                    }
                });
                classCardHtml += `</div>`;

                if (addedAnyClassField) {
                    infoGrid.insertAdjacentHTML('afterend', classCardHtml);
                }
            } else {
                infoGrid.style.display = 'grid'; // Restore grid for other types
                
                const getVal = (key) => artifact[`${key}_${lang}`] || artifact[`${key}${lang.charAt(0).toUpperCase() + lang.slice(1)}`] || artifact[`${key}-${lang}`] || artifact[`${key}_ar`] || artifact[`${key}Ar`] || artifact[`${key}-ar`] || artifact[key];

                const fields = [];

                if (collectionId.includes('tourism')) {
                    const eraVal = getVal('era');
                    if (eraVal) fields.push({ label: l.era, value: eraVal, icon: 'fas fa-history' });

                    const matVal = getVal('material');
                    if (matVal) fields.push({ label: l.material, value: matVal, icon: 'fas fa-cube' });

                    const dimVal = getVal('dimensions');
                    if (dimVal) fields.push({ label: l.dimensions, value: dimVal, icon: 'fas fa-ruler-combined' });
                    
                    const locVal = getVal('location');
                    if (locVal) fields.push({ label: l.location, value: locVal, icon: 'fas fa-map-marker-alt' });
                } else if (collectionId.includes('art_')) {
                    const authorVal = getVal('author');
                    if (authorVal) fields.push({ label: l.author, value: authorVal, icon: 'fas fa-palette' });

                    const serialVal = artifact.serial_number || artifact.serialNumber || artifact['serial-number'];
                    if (serialVal) fields.push({ label: l.serial, value: serialVal, icon: 'fas fa-hashtag' });

                    const sizeVal = getVal('size');
                    if (sizeVal) fields.push({ label: l.size, value: sizeVal, icon: 'fas fa-ruler-combined' });

                    const typeVal = getVal('type');
                    if (typeVal) fields.push({ label: l.type, value: typeVal, icon: 'fas fa-paint-brush' });
                } else if (collectionId.includes('science')) {
                    fields.push({ label: l.museum, value: museumName, icon: 'fas fa-museum' });
                    fields.push({ label: l.category, value: lang==='en'?'Science':(lang==='fr'?'Science':'علوم'), icon: 'fas fa-tags' });

                    const serialVal = artifact.serial_number || artifact.serialNumber || artifact['serial-number'];
                    if (serialVal) fields.push({ label: l.serial, value: serialVal, icon: 'fas fa-hashtag' });
                } else if (isGeologyCollection(collectionId)) {
                    const classVal = getGeologyField(artifact, lang,
                        ['Classification-ar', 'Classification_ar', 'classification-ar', 'classification_ar'],
                        ['Classification-en', 'Classification_en', 'classification-en', 'classification_en']
                    ) || getVal('Classification') || getVal('classification');
                    if (classVal) fields.push({
                        label: lang === 'en' ? 'Classification' : (lang === 'fr' ? 'Classification' : 'التصنيف'),
                        value: classVal,
                        icon: 'fas fa-gem'
                    });

                    const compVal = getGeologyField(artifact, lang,
                        ['formation-ar', 'formation_ar', 'composition-ar', 'composition_ar'],
                        ['formation-en', 'formation_en', 'composition-en', 'composition_en']
                    ) || getVal('formation') || getVal('composition');
                    if (compVal) fields.push({
                        label: lang === 'en' ? 'Composition' : (lang === 'fr' ? 'Composition' : 'التكوين'),
                        value: compVal,
                        icon: 'fas fa-layer-group'
                    });

                    const ageVal = getGeologyField(artifact, lang,
                        ['age_ar', 'age-ar'], ['age_en', 'age-en']
                    ) || getVal('age');
                    if (ageVal) fields.push({
                        label: lang === 'en' ? 'Geological Age' : (lang === 'fr' ? 'Âge géologique' : 'العمر الجيولوجي'),
                        value: ageVal,
                        icon: 'fas fa-history'
                    });

                    const examplesVal = getGeologyField(artifact, lang,
                        ['examples_ar', 'examples-ar'], ['examples_en', 'examples-en']
                    );
                    if (examplesVal) fields.push({
                        label: lang === 'en' ? 'Key Exhibits' : (lang === 'fr' ? 'Pièces clés' : 'أبرز المعروضات'),
                        value: examplesVal,
                        icon: 'fas fa-list'
                    });
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
        }

        // Audio Guide Logic
        const audioFileId = artifact[`audio_guide_${lang}`] || artifact[`audio_guide-${lang}`] ||
            artifact[`audio-${lang}`] || artifact[`audio_${lang}`] || artifact['audio-ar'] || artifact.audio_ar || '';
        if (audioFileId && audioSection && audioPlayer) {
            const audioBucketId = AppwriteConfig.buckets.audio;
            const audioUrl = getAppwriteImageUrl(audioFileId, audioBucketId);
            
            audioPlayer.src = audioUrl;
            audioPlayer.load();
            audioSection.style.display = 'block';

            // Generate Waveform Bars
            const waveformBars = document.getElementById('waveform-bars');
            if (waveformBars) {
                waveformBars.innerHTML = '';
                const barHeights = [20, 35, 50, 65, 45, 25, 35, 55, 75, 90, 65, 30, 45, 60, 80, 95, 80, 55, 35, 45, 65, 75, 55, 30, 25, 45, 65, 80, 50, 30, 20, 35, 50, 40, 20];
                barHeights.forEach((h) => {
                    const bar = document.createElement('div');
                    bar.className = 'waveform-bar';
                    bar.style.height = `${h}%`;
                    waveformBars.appendChild(bar);
                });
            }

            const seekerHead = document.getElementById('seeker-head');
            const seekerTimeEl = document.getElementById('seeker-time');
            const waveformSlider = document.getElementById('waveform-slider');

            playPauseBtn.onclick = () => {
                if (audioPlayer.paused) {
                    audioPlayer.play();
                    playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
                } else {
                    audioPlayer.pause();
                    playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
                }
            };

            audioPlayer.onloadedmetadata = () => {
                if (seekerTimeEl) {
                    seekerTimeEl.innerText = `00:00 / ${formatTime(audioPlayer.duration)}`;
                }
            };

            audioPlayer.ontimeupdate = () => {
                if (!audioPlayer.duration) return;
                const currentTime = audioPlayer.currentTime;
                const duration = audioPlayer.duration;
                const pct = (currentTime / duration) * 100;
                
                if (seekerHead) {
                    seekerHead.style.left = `${pct}%`;
                }
                if (seekerTimeEl) {
                    seekerTimeEl.innerText = `${formatTime(currentTime)} / ${formatTime(duration)}`;
                }

                // Highlight active waveform bars
                const bars = document.querySelectorAll('.waveform-bar');
                const activeCount = Math.round((pct / 100) * bars.length);
                bars.forEach((bar, idx) => {
                    if (idx < activeCount) {
                        bar.classList.add('active');
                    } else {
                        bar.classList.remove('active');
                    }
                });
            };

            // Custom Seeker Click/Drag Support
            if (waveformSlider) {
                let isDragging = false;
                
                const updateSeek = (e) => {
                    const rect = waveformSlider.getBoundingClientRect();
                    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                    const x = clientX - rect.left;
                    const pct = Math.max(0, Math.min(1, x / rect.width));
                    
                    if (audioPlayer.duration) {
                        audioPlayer.currentTime = pct * audioPlayer.duration;
                    }
                };
                
                waveformSlider.addEventListener('mousedown', (e) => {
                    isDragging = true;
                    updateSeek(e);
                });
                
                window.addEventListener('mousemove', (e) => {
                    if (isDragging) {
                        updateSeek(e);
                    }
                });
                
                window.addEventListener('mouseup', () => {
                    isDragging = false;
                });
                
                waveformSlider.addEventListener('touchstart', (e) => {
                    isDragging = true;
                    updateSeek(e);
                }, { passive: true });
                
                window.addEventListener('touchmove', (e) => {
                    if (isDragging) {
                        updateSeek(e);
                    }
                }, { passive: true });
                
                window.addEventListener('touchend', () => {
                    isDragging = false;
                });
            }
        }

        if (isGeologyCollection(collectionId)) {
            renderGeologyExtraSections(artifact, lang);
            const glbId = artifact.glbFileId || artifact.glbFileld || artifact.glb_file_id || '';
            if (glbId && glbId.trim().length > 5) {
                preloadGlbModel(glbId, collectionId);
            }
        } else if (isZoologyCollection(collectionId)) {
            renderZoologyExtraSections(artifact, lang);
        } else {
            const extra = document.getElementById('geology-extra-sections');
            if (extra) extra.innerHTML = '';
        }

        // 360 GLB Model Logic
        const btn360Wrap = document.getElementById('btn-360-wrap');
        const btn360Element = document.getElementById('btn-360-element');
        const glbFileId = artifact.glbFileId || artifact.glbFileld || artifact.glb_file_id || '';
        if (glbFileId && btn360Wrap && btn360Element) {
            btn360Wrap.style.display = 'block';
            
            // Preload GLB model immediately on details page
            preloadGlbModel(glbFileId, collectionId);

            const handle360Click = () => {
                const modelUrls = resolveGlbModelUrls(glbFileId, collectionId);
                const primary = modelUrls[0] || getAppwriteStorageUrl(glbFileId, AppwriteConfig.buckets.arModels, 'view');
                const fallbacks = modelUrls.slice(1).join('|');
                let viewerUrl = `viewer3d.html?url=${encodeURIComponent(primary)}&title=${encodeURIComponent(name)}&collection=${encodeURIComponent(collectionId)}`;
                if (fallbacks) viewerUrl += `&fallbacks=${encodeURIComponent(fallbacks)}`;
                window.location.href = viewerUrl;
            };
            btn360Element.onclick = () => { handle360Click(); };

            // Auto-redirect if show3d is true
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('show3d') === 'true') {
                const newSearch = window.location.search.replace(/[&?]show3d=true/, '');
                window.history.replaceState({}, document.title, window.location.pathname + newSearch);
                handle360Click();
            }
        } else if (btn360Wrap) {
            btn360Wrap.style.display = 'none';
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
    // Ensure Appwrite SDK is initialized before any Appwrite calls
    if (!initAppwrite()) {
        // Retry a few times in case the SDK is still loading
        let attempts = 0;
        const interval = setInterval(() => {
            attempts++;
            if (initAppwrite() || attempts > 8) {
                clearInterval(interval);
            }
        }, 200);
    }
    const normalizeArabic = (text) => {
        if (!text) return '';
        return text.replace(/[أإآ]/g, 'ا')
                   .replace(/ة/g, 'ه')
                   .replace(/ى/g, 'ي')
                   .replace(/ؤ/g, 'و')
                   .replace(/ئ/g, 'ي')
                   .replace(/َ|ً|ُ|ٌ|ِ|ٍ|ْ|ّ/g, ''); // Remove tashkeel
    };

    const artifactSearchInput = document.getElementById('artifact-search');
    if (artifactSearchInput) {
        artifactSearchInput.oninput = () => {
            const q = normalizeArabic(artifactSearchInput.value.toLowerCase());
            renderArtifacts(museumArtifactsCache.filter(a => {
                const title = normalizeArabic(getArtifactTitle(a).toLowerCase());
                return title.includes(q);
            }));
        };
    }

    // Navbar Scroll Effect
    const navbar = document.querySelector('.navbar');
    let isScrolling = false;
    window.addEventListener('scroll', () => {
        if (!isScrolling && navbar) {
            window.requestAnimationFrame(() => {
                if (window.scrollY > 50) {
                    navbar.classList.add('scrolled');
                } else {
                    navbar.classList.remove('scrolled');
                }
                isScrolling = false;
            });
            isScrolling = true;
        }
    }, { passive: true });

    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    if (sendBtn && userInput) {
        sendBtn.onclick = handleChat;
        userInput.onkeypress = (e) => { if (e.key === 'Enter') handleChat(); };

        // Initialize Speech Recognition for main chat
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            mainRecognition = new SpeechRecognition();
            mainRecognition.continuous = false;
            mainRecognition.interimResults = false;
            mainRecognition.lang = 'ar-EG';

            mainRecognition.onresult = (event) => {
                const speechToText = event.results[0][0].transcript;
                userInput.value = speechToText;
            };

            mainRecognition.onend = () => {
                isMainRecording = false;
                const micBtn = document.getElementById('mic-btn');
                if (micBtn) {
                    micBtn.innerHTML = '<i class="fas fa-microphone"></i>';
                    micBtn.style.color = '#B8860B';
                }
            };

            mainRecognition.onerror = (event) => {
                console.error('Main speech recognition error:', event.error);
            };
        }

        const micBtn = document.getElementById('mic-btn');
        if (micBtn) {
            micBtn.onclick = () => {
                if (!mainRecognition) {
                    alert('عذراً، متصفحك لا يدعم التعرف على الصوت.');
                    return;
                }
                if (isMainRecording) {
                    mainRecognition.stop();
                } else {
                    isMainRecording = true;
                    micBtn.innerHTML = '<i class="fas fa-circle fa-beat text-danger"></i>';
                    mainRecognition.start();
                }
            };
        }
    }
});

async function handleChat() {
    const userInput = document.getElementById('user-input');
    const chatMessages = document.getElementById('chat-messages');
    if (!userInput || !chatMessages) return;

    const text = userInput.value.trim();
    if (!text) return;

    // Stop recording if active
    if (isMainRecording && mainRecognition) {
        mainRecognition.stop();
    }
    
    const lang = getCurrentLang();
    
    const addMsg = (t, s) => {
        const d = document.createElement('div');
        d.className = `message ${s}-msg`;
        d.innerText = t;
        chatMessages.appendChild(d);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    addMsg(text, 'user');
    userInput.value = '';
    
    const thinkingText = lang === 'en' ? 'Thinking...' : (lang === 'fr' ? 'Analyse...' : 'جاري التفكير...');
    const thinking = document.createElement('div');
    thinking.className = 'message system-msg thinking';
    thinking.innerText = thinkingText;
    chatMessages.appendChild(thinking);

    const geminiConfig = await window.getGeminiConfig();
    const API_KEY = geminiConfig ? geminiConfig.apiKey : null;
    const GEMINI_MODEL = geminiConfig ? geminiConfig.model : 'gemini-1.5-pro';

    if (!API_KEY) {
        thinking.remove();
        const noApiKeyText = lang === 'en' ? 'Sorry, I couldn\'t retrieve the AI API key at the moment.' : 
                             (lang === 'fr' ? 'Désolé, je n\'ai pas pu récupérer la clé API de l\'IA pour le moment.' : 'عذراً، لم أستطع جلب مفتاح API للذكاء الاصطناعي حالياً.');
        addMsg(noApiKeyText, 'system');
        return;
    }

    // Ensure Appwrite databases is initialized
    if (!databases) {
        initAppwrite();
    }

    let dbContext = '';
    if (databases && Query) {
        try {
            const collectionsToSearch = [
                { id: AppwriteConfig.collections.tourism, fields: ['name-ar', 'name-en'] },
                { id: AppwriteConfig.collections.art, fields: ['name-ar', 'name-en'] },
                { id: AppwriteConfig.collections.science, fields: ['name-ar', 'name-en'] },
                { id: AppwriteConfig.collections.geology, fields: ['title-ar', 'title-en'] },
                { id: AppwriteConfig.collections.zoology, fields: ['name-ar', 'name-en'] }
            ];

            let searchQuery = extractSearchQuery(text);

            const searchPromises = collectionsToSearch.map(async (col) => {
                if (!col.id) return [];
                try {
                    let response = await databases.listDocuments(
                        AppwriteConfig.databaseId,
                        col.id,
                        [
                            Query.or([
                                Query.contains(col.fields[0], searchQuery),
                                Query.contains(col.fields[1], searchQuery)
                            ]),
                            Query.limit(5)
                        ]
                    );

                    // If no matches, try searching with the longest keyword
                    if (response.documents.length === 0 && searchQuery.includes(' ')) {
                        const words = searchQuery.split(' ').sort((a, b) => b.length - a.length);
                        if (words.length > 0 && words[0].length > 2) {
                            response = await databases.listDocuments(
                                AppwriteConfig.databaseId,
                                col.id,
                                [
                                    Query.or([
                                        Query.contains(col.fields[0], words[0]),
                                        Query.contains(col.fields[1], words[0])
                                    ]),
                                    Query.limit(5)
                                ]
                            );
                        }
                    }

                    return response.documents.map(doc => {
                        const nameAr = doc['name-ar'] || doc['name_ar'] || doc['title-ar'] || doc['title_ar'] || '';
                        const nameEn = doc['name-en'] || doc['name_en'] || doc['title-en'] || doc['title_en'] || '';
                        const descAr = doc['description-ar'] || doc['description_ar'] || doc['overview-ar'] || doc['overview_ar'] || doc['overview-Ar'] || '';
                        return {
                            id: doc.$id,
                            nameAr,
                            nameEn,
                            collection: col.id,
                            descriptionAr: descAr
                        };
                    });
                } catch (err) {
                    console.warn(`Search failed on collection ${col.id}:`, err);
                    return [];
                }
            });

            const results = await Promise.all(searchPromises);
            const flatResults = results.flat();
            if (flatResults.length > 0) {
                dbContext = "\n\n[معلومات حية من قاعدة بيانات المتحف عن القطع ذات الصلة بسؤال المستخدم:\n";
                flatResults.forEach(art => {
                    dbContext += `- القطعة: ${art.nameAr} (${art.nameEn})\n` +
                                 `  المعرف (ID): ${art.id}\n` +
                                 `  المجموعة (Collection): ${art.collection}\n` +
                                 `  الوصف: ${art.descriptionAr}\n`;
                });
                dbContext += "استخدم هذه البيانات كلياً للإجابة بدقة وبنفس اللغة المطلوبة. ولا تخترع معلومات غير موجودة.]";
            }
        } catch (dbErr) {
            console.error('Database search error in handleChat:', dbErr);
        }
    }

    const SYSTEM_PROMPT = lang === 'en' 
        ? "You are Ego Pro, a smart and highly interactive assistant expert in Minia University Museums. Guidelines:\n" +
          "1. Answer professionally, concisely, and in detail in English.\n" +
          "2. NEVER output raw database document IDs (like '69f82d...') or collection names to the user. If you need to refer to an identifier, refer to it as the 'registered QR code' or 'QR code'.\n" +
          "3. If a question is within the museum context but no live database context is provided or found, respond politely with: 'No data is available about this.' or 'Sorry, no details are available in the database currently.' do not hallucinate details."
        : (lang === 'fr'
            ? "Vous êtes Ego Pro, un assistant intelligent et hautement interactif expert des musées de l'Université de Minia. Directives:\n" +
              "1. Répondez de manière professionnelle, concise et détaillée en français.\n" +
              "2. N'affichez JAMAIS d'identifiants de documents bruts (comme '69f82d...') ou de noms de collections à l'utilisateur. Si vous devez faire référence à un identifiant, appelez-le 'code QR enregistré'.\n" +
              "3. Si la question concerne les musées mais qu'aucune information n'est disponible dans la base de données, répondez poliment par: 'Aucune donnée n'est disponible à ce sujet.' ou 'Désolé, aucune donnée n'est disponible dans la base de données actuellement.' n'inventez pas de détails."
            : "أنت Ego Pro، مساعد ذكي وتفاعلي للغاية خبير في متاحف جامعة المنيا. شروط هامة:\n" +
              "1. أجب باحترافية وبشكل مبسط وودود باللغة العربية.\n" +
              "2. يمنع منعاً باتاً عرض أي معلومات تقنية سرية من قاعدة البيانات للمستخدم؛ مثل معرّفات المستندات البرمجية (مثل '69f82d...' أو 'docId') أو أسماء المجموعات (مثل 'tourism_artifacts'). إذا أردت الإشارة لمعرّف القطعة، أبلغه أن معرف القطعة هو \"كود QR المسجل\" أو \"رمز QR المسجل\".\n" +
              "3. عندما يسألك المستخدم سؤالاً في نطاق متاحف جامعة المنيا والقطع الأثرية، وتبين لك عدم وجود بيانات حية مرفقة في السياق الممرر لك من قاعدة البيانات، فلا تقل \"لا أعرف\"، بل قل بدقة: \"لا تتوفر لديك بيانات عن ذلك.\" أو \"عذراً، لا تتوفر بيانات عن هذا في قاعدة البيانات حالياً.\"");

    try {
        const userPromptText = dbContext ? `${text}${dbContext}` : text;
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                contents: [{ 
                    parts: [
                        { text: SYSTEM_PROMPT },
                        { text: userPromptText }
                    ] 
                }] 
            })
        });
        
        const data = await res.json();
        thinking.remove();
        
        if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts) {
            const responseText = data.candidates[0].content.parts[0].text;
            addMsg(responseText, 'system');
            
            // TTS Readback
            if (isTtsActive) {
                window.speechSynthesis.cancel(); // Cancel any current speech
                const utterance = new SpeechSynthesisUtterance(responseText);
                utterance.lang = lang === 'en' ? 'en-US' : (lang === 'fr' ? 'fr-FR' : 'ar-EG');
                window.speechSynthesis.speak(utterance);
            }
        } else {
            const processErrorText = lang === 'en' ? 'Sorry, I couldn\'t process your request at the moment.' : 
                                     (lang === 'fr' ? 'Désolé, je n\'ai pas pu traiter votre demande pour le moment.' : 'عذراً، لم أستطع معالجة طلبك حالياً.');
            addMsg(processErrorText, 'system');
        }
    } catch (e) { 
        thinking.remove(); 
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 2);
        const locale = lang === 'en' ? 'en-US' : (lang === 'fr' ? 'fr-FR' : 'ar-EG');
        const dateString = futureDate.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
        
        const fallbackMsg = lang === 'en' 
            ? `We will be back soon. We expect to resume operations by: ${dateString}`
            : (lang === 'fr'
                ? `Nous serons de retour bientôt. Nous prévoyons de reprendre nos opérations d'ici le : ${dateString}`
                : `سوف نعود قريباً. نتوقع العودة للعمل بحلول: ${dateString}`);
        addMsg(fallbackMsg, 'system'); 
    }
}

// Theme and Language Toggle Logic
document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');
    const langSwitches = document.querySelectorAll('.lang-switch');
    const currentLangText = document.getElementById('current-lang-text');

    // Theme Toggle
    if (themeToggle) {
        // Check saved theme
        const savedTheme = sessionStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        themeToggle.innerHTML = savedTheme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';

        themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            sessionStorage.setItem('theme', newTheme);
            themeToggle.innerHTML = newTheme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        });
    }

    // Language Toggle (Basic setup)
    const translations = {
            en: {
                "nav_home": "Home",
                "nav_museums": "Museums",
                "nav_features": "Features",
                "nav_assistant": "AI Assistant",
                "nav_download": "Download App",
                "featured_stories": "Highlights",
                "brand_subtitle": "Minia University Museums",
                "hero_badge": "Future of Digital Tourism",
                "hero_slogan": "The past... like never seen before",
                "hero_title_1": "Where",
                "hero_title_2": "Art & Science",
                "hero_title_3": "Meet",
                "hero_desc": "Explore Minia University treasures through Mat7afi. A unique digital experience combining modern art, nature secrets, and deep history.",
                "btn_start": "Start Exploring",
                "btn_tour": "Museum Tour",
                "bottom_home": "Home",
                "bottom_museums": "Museums",
                "bottom_features": "Features",
                "bottom_assistant": "Assistant",
                "museums_title": "Our Featured Museums",
                "museums_subtitle": "Three cultural destinations, one integrated experience",
                "tourism_cat": "Antiquities",
                "tourism_title": "Tourism Faculty Museum",
                "tourism_desc": "Displays models simulating ancient Egyptian eras, from Pharaonic to Islamic.",
                "explore_pieces": "Explore Artifacts",
                "artifact_360": "360° View",
                "artifact_history": "Summoning History...",
                "science_cat": "Science",
                "science_title": "Science Faculty Museums",
                "science_desc": "A journey into the world of nature and geological history through hundreds of rare specimens.",
                "art_cat": "Arts",
                "art_title": "Modern Art Museum",
                "art_desc": "Features a unique collection of contemporary paintings and sculptures reflecting Egyptian creativity.",
                "gallery_title": "Inside the App",
                "gallery_subtitle": "Modern interfaces designed for your comfort",
                "feat_title": "Technologies Beyond Expectations",
                "feat_desc": "Mat7afi app is not just a tourist guide, it's your companion on a comprehensive journey exploring art, science, and nature.",
                "feat_qr": "Smart QR Scanner",
                "feat_qr_desc": "Identify paintings, scientific specimens, and artifacts in seconds.",
                "feat_audio": "Comprehensive Audio Guide",
                "feat_audio_desc": "Enjoy a detailed, high-quality audio explanation of all museum collections.",
                "feat_ai": "AI Chatbot",
                "feat_ai_desc": "Instant interactive chat to answer all your questions about any artifact or specimen.",
                "feat_store": "Online Store",
                "feat_store_desc": "Soon you'll be able to purchase souvenirs and miniature replicas of our masterpieces.",
                "feat_ar": "Augmented Reality (AR)",
                "feat_ar_desc": "View 3D models of artifacts and scientific specimens in your own environment.",
                "soon": "Soon",
                "ai_status": "Ego Pro",
                "ai_desc": "",
                "ai_active": "Online",
                "ai_welcome": "Welcome! I am Ego Pro, your smart guide. How can I help you today?",
                "ai_placeholder": "Ask me about any artifact...",
                "download_title": "Carry the Museums in your Pocket",
                "download_desc": "Get the full experience through the official app. Available soon on official stores and available now for direct download.",
                "download_direct": "Direct Download (Device Versions)",
                "download_direct_desc": "Download the appropriate file for your device and install it directly.",
                "apk_universal": "x86_64 Emulator APK (~47 MB)",
                "apk_arm64": "ARM64-v8a APK (~45 MB)",
                "apk_armv7": "ARMv7 APK (~41 MB)",
                "footer_desc": "The official digital project to document and display the treasures of Minia University museums using the latest technologies.",
                "footer_links_title": "Quick Links",
                "footer_privacy": "Privacy Policy",
                "footer_terms": "Terms and Conditions",
                "footer_follow": "Follow Us",
                "footer_rights": "© 2026 All Rights Reserved to Minia University",
                "footer_dev": "Developed by",
                "gallery_nav": "Museum Gallery",
                "gallery_page_title": "Museum Gallery",
                "gallery_page_subtitle": "Explore images, artifact cards, and digital files from Minia University Museums.",
                "gallery_loading": "Loading Gallery...",
                "gallery_empty_title": "No Results Found",
                "gallery_empty_desc": "Sorry, no items match your search or selected filters. Try changing your search terms or select 'All'.",
                "fav_title": "Favorites",
                "fav_subtitle": "Your private list of saved items and files to revisit later.",
                "fav_loading": "Loading Favorites...",
                "fav_empty_title": "No Items in Favorites Yet",
                "fav_empty_desc": "You can explore our comprehensive digital gallery and save the images and files that interest you to easily revisit them later.",
                "fav_empty_btn": "Browse Gallery Now",
                "filter_all": "All",
                "filter_tourism": "Tourism Faculty Museum",
                "filter_science": "Science Museum",
                "filter_art": "Modern Art Museum",
                "filter_images": "Images",
                "filter_cards": "Artifact Cards",
                "filter_files": "Files",
                "gallery_search_placeholder": "Search for artifact, file, or museum...",
                "museum_search_placeholder": "Search inside this museum's collections..."
            },
            ar: {
                "nav_home": "الرئيسية",
                "nav_museums": "متاحفنا",
                "nav_features": "المميزات",
                "nav_assistant": "المساعد الذكي",
                "nav_download": "تحميل التطبيق",
                "featured_stories": "أبرز القصص",
                "brand_subtitle": "متاحف جامعة المنيا",
                "hero_badge": "مستقبل السياحة الرقمية",
                "hero_slogan": "الماضي... بشكل عمره ما اتشاف",
                "hero_title_1": "حيث يلتقي",
                "hero_title_2": "الفن والعلوم",
                "hero_title_3": "",
                "hero_desc": "اكتشف كنوز جامعة المنيا من خلال تطبيق Mat7afi. تجربة فريدة تجمع بين سحر الفن الحديث، أسرار الطبيعة والعلوم، وعمق التاريخ الأثري في منصة واحدة متطورة.",
                "btn_start": "ابدأ الاستكشاف الآن",
                "btn_tour": "جولة في المتاحف",
                "bottom_home": "الرئيسية",
                "bottom_museums": "متاحفنا",
                "bottom_features": "المميزات",
                "bottom_assistant": "المساعد",
                "museums_title": "متاحفنا المتميزة",
                "museums_subtitle": "ثلاث وجهات ثقافية، تجربة واحدة متكاملة",
                "tourism_cat": "الآثار",
                "tourism_title": "متحف كلية السياحة",
                "tourism_desc": "يعرض نماذج تحاكي العصور المصرية القديمة من الفرعوني وحتى الإسلامي.",
                "explore_pieces": "استكشف القطع",
                "artifact_360": "عـرض 360°",
                "artifact_history": "جاري استحضار التاريخ...",
                "science_cat": "العلوم",
                "science_title": "متاحف كلية العلوم",
                "science_desc": "رحلة في عالم الطبيعة والتاريخ الجيولوجي عبر مئات العينات النادرة والفريدة.",
                "art_cat": "الفنون",
                "art_title": "متحف الفن الحديث",
                "art_desc": "يضم مجموعة فريدة من اللوحات والمنحوتات المعاصرة التي تعكس الإبداع المصري.",
                "gallery_title": "نظرة داخل التطبيق",
                "gallery_subtitle": "واجهات عصرية مصممة لراحتك",
                "feat_title": "تقنيات تفوق التوقعات",
                "feat_desc": "تطبيق Mat7afi ليس مجرد دليل سياحي، بل هو رفيقك في رحلة استكشاف شاملة للفن والعلوم والطبيعة.",
                "feat_qr": "ماسح QR ذكي",
                "feat_qr_desc": "تعرف على اللوحات الفنية، العينات العلمية، والقطع الأثرية في ثوانٍ.",
                "feat_audio": "دليل صوتي شامل",
                "feat_audio_desc": "استمتع بشرح صوتي مفصل لكل مقتنيات المتاحف الثلاثة بأعلى جودة.",
                "feat_ai": "مساعد ذكي (AI Chatbot)",
                "feat_ai_desc": "دردشة تفاعلية فورية للإجابة على جميع تساؤلاتك حول أي قطعة أثرية أو علمية.",
                "feat_store": "المتجر الإلكتروني",
                "feat_store_desc": "قريباً ستتمكن من اقتناء هدايا تذكارية ونسخ مصغرة من روائعنا الفنية.",
                "feat_ar": "واقع معزز (AR)",
                "feat_ar_desc": "مشاهدة ثلاثية الأبعاد للقطع الأثرية والعينات العلمية في بيئتك الخاصة.",
                "soon": "قريباً",
                "ai_status": "ايجو برو",
                "ai_desc": "",
                "ai_active": "متصل الآن",
                "ai_welcome": "مرحباً بك! أنا Ego Pro مرشدك الذكي. كيف يمكنني مساعدتك اليوم؟",
                "ai_placeholder": "اسألني عن أي قطعة أثرية...",
                "download_title": "احمل المتاحف في جيبك",
                "download_desc": "احصل على التجربة الكاملة عبر التطبيق الرسمي. متوفر قريباً على المتاجر الرسمية ومتاح الآن للتحميل المباشر.",
                "download_direct": "تحميل مباشر (إصدارات الأجهزة)",
                "download_direct_desc": "يمكنك تحميل الملف المناسب لنوع جهازك وتثبيته مباشرة.",
                "apk_universal": "تحميل x86_64 APK للمحاكيات (~47 ميجا)",
                "apk_arm64": "تحميل ARM64-v8a APK (~45 ميجا)",
                "apk_armv7": "تحميل ARMv7 APK (~41 ميجا)",
                "footer_desc": "المشروع الرقمي الرسمي لتوثيق وعرض كنوز متاحف جامعة المنيا باستخدام أحدث التقنيات.",
                "footer_links_title": "روابط سريعة",
                "footer_privacy": "سياسة الخصوصية",
                "footer_terms": "الشروط والأحكام",
                "footer_follow": "تابعنا",
                "footer_rights": "© 2026 جميع الحقوق محفوظة لجامعة المنيا",
                "footer_dev": "تم التطوير بواسطة",
                "gallery_nav": "معرض متحفي",
                "gallery_page_title": "معرض متحفي",
                "gallery_page_subtitle": "استكشف الصور والبطاقات الأثرية والملفات الرقمية الخاصة بمتاحف جامعة المنيا.",
                "gallery_loading": "جاري تحميل المعرض...",
                "gallery_empty_title": "لم يتم العثور على نتائج",
                "gallery_empty_desc": "عفواً، لا توجد عناصر مطابقة لبحثك أو الفلاتر المحددة. جرب تغيير كلمات البحث أو اختر \"الكل\" لعرض كافة المقتنيات.",
                "fav_title": "المفضلة",
                "fav_subtitle": "قائمتك الخاصة بالعناصر والملفات التي قمت بحفظها للرجوع إليها لاحقاً.",
                "fav_loading": "جاري تحميل المفضلة...",
                "fav_empty_title": "لم تقم بإضافة أي عناصر للمفضلة بعد",
                "fav_empty_desc": "يمكنك استكشاف معرضنا الرقمي الشامل وإضافة الصور والملفات الأثرية التي تثير اهتمامك للرجوع إليها لاحقاً بكل سهولة.",
                "fav_empty_btn": "تصفح المعرض الآن",
                "filter_all": "الكل",
                "filter_tourism": "متحف كلية السياحة والفنادق",
                "filter_science": "متحف العلوم",
                "filter_art": "متحف الفن الحديث",
                "filter_images": "الصور",
                "filter_cards": "البطاقات الأثرية",
                "filter_files": "الملفات",
                "gallery_search_placeholder": "ابحث عن أثر، ملف، أو متحف...",
                "museum_search_placeholder": "ابحث داخل مقتنيات هذا المتحف..."
            },
            fr: {
                "nav_home": "Accueil",
                "nav_museums": "Musées",
                "nav_features": "Fonctionnalités",
                "nav_assistant": "Assistant IA",
                "nav_download": "Télécharger",
                "featured_stories": "Faits Saillants",
                "brand_subtitle": "Musées de l'Université de Minia",
                "hero_badge": "L'Avenir du Tourisme Numérique",
                "hero_slogan": "Le passé... comme jamais vu auparavant",
                "hero_title_1": "Où",
                "hero_title_2": "Art et Science",
                "hero_title_3": "Se Rencontrent",
                "hero_desc": "Découvrez les trésors de l'Université de Minia via Mat7afi. Une expérience numérique unique alliant art moderne, nature et histoire profonde.",
                "btn_start": "Commencer l'Exploration",
                "btn_tour": "Visite du Musée",
                "bottom_home": "Accueil",
                "bottom_museums": "Musées",
                "bottom_features": "Fonctions",
                "bottom_assistant": "Assistant",
                "museums_title": "Nos Musées en Vedette",
                "museums_subtitle": "Trois destinations culturelles, une expérience intégrée",
                "tourism_cat": "Antiquités",
                "tourism_title": "Musée de la Faculté de Tourisme",
                "tourism_desc": "Expose des maquettes simulant les époques égyptiennes anciennes, de l'époque pharaonique à l'époque islamique.",
                "explore_pieces": "Explorer les pièces",
                "artifact_360": "Vue 360°",
                "artifact_history": "Invocation de l'histoire...",
                "science_cat": "Science",
                "science_title": "Musées de la Faculté des Sciences",
                "science_desc": "Un voyage dans le monde de la nature et de l'histoire géologique à travers des centaines de spécimens rares.",
                "art_cat": "Arts",
                "art_title": "Musée d'Art Moderne",
                "art_desc": "Présente une collection unique de peintures et sculptures contemporaines reflétant la créativité égyptienne.",
                "gallery_title": "À l'Intérieur de l'App",
                "gallery_subtitle": "Des interfaces modernes conçues pour votre confort",
                "feat_title": "Des Technologies au-delà des Attentes",
                "feat_desc": "L'application Mat7afi n'est pas seulement un guide, c'est votre compagnon pour un voyage complet.",
                "feat_qr": "Scanner QR Intelligent",
                "feat_qr_desc": "Identifiez peintures, spécimens scientifiques et artefacts en quelques secondes.",
                "feat_audio": "Guide Audio Complet",
                "feat_audio_desc": "Profitez d'une explication audio détaillée et de haute qualité de toutes les collections.",
                "feat_ai": "Chatbot IA",
                "feat_ai_desc": "Chat interactif instantané pour répondre à toutes vos questions.",
                "feat_store": "Boutique en Ligne",
                "feat_store_desc": "Bientôt, vous pourrez acheter des souvenirs et des répliques miniatures de nos chefs-d'œuvre.",
                "feat_ar": "Réalité Augmentée (RA)",
                "feat_ar_desc": "Visualisez des modèles 3D d'artefacts et de spécimens dans votre propre environnement.",
                "soon": "Bientôt",
                "ai_status": "Ego Pro",
                "ai_desc": "",
                "ai_active": "En ligne",
                "ai_welcome": "Bienvenue ! Je suis Ego Pro, votre guide intelligent. Comment puis-je vous aider aujourd'hui ?",
                "ai_placeholder": "Interrogez-moi sur n'importe quel artefact...",
                "download_title": "Transportez les Musées dans votre Poche",
                "download_desc": "Obtenez l'expérience complète via l'application officielle. Disponible bientôt.",
                "download_direct": "Téléchargement Direct (Versions Appareils)",
                "download_direct_desc": "Téléchargez le fichier approprié pour votre appareil et installez-le directement.",
                "apk_universal": "APK x86_64 Émulateur (~47 Mo)",
                "apk_arm64": "APK ARM64-v8a (~45 Mo)",
                "apk_armv7": "APK ARMv7 (~41 Mo)",
                "footer_desc": "Le projet numérique officiel pour documenter et exposer les trésors des musées de l'Université de Minia.",
                "footer_links_title": "Liens Rapides",
                "footer_privacy": "Politique de Confidentialité",
                "footer_terms": "Conditions Générales",
                "footer_follow": "Suivez-nous",
                "footer_rights": "© 2026 Tous Droits Réservés à l'Université de Minia",
                "footer_dev": "Développé par",
                "gallery_nav": "Galerie du Musée",
                "gallery_page_title": "Galerie du Musée",
                "gallery_page_subtitle": "Explorez des images, des cartes et des fichiers numériques.",
                "gallery_loading": "Chargement de la galerie...",
                "gallery_empty_title": "Aucun résultat trouvé",
                "gallery_empty_desc": "Désolé, aucun élément ne correspond à votre recherche.",
                "fav_title": "Favoris",
                "fav_subtitle": "Votre liste privée d'éléments enregistrés.",
                "fav_loading": "Chargement des favoris...",
                "fav_empty_title": "Aucun élément dans les favoris",
                "fav_empty_desc": "Vous pouvez explorer notre galerie numérique et enregistrer des images.",
                "fav_empty_btn": "Parcourir la galerie",
                "filter_all": "Tout",
                "filter_tourism": "Tourisme",
                "filter_science": "Science",
                "filter_art": "Art",
                "filter_images": "Images",
                "filter_cards": "Cartes",
                "filter_files": "Fichiers",
                "gallery_search_placeholder": "Rechercher un artefact, fichier, ou musée...",
                "museum_search_placeholder": "Rechercher dans les collections de ce musée..."
            }
        };
        window.translations = translations;

        const updateLanguage = (lang) => {
            document.documentElement.lang = lang;
            document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
            
            // Swap Bootstrap CSS for perfect RTL/LTR layout mirroring
            const bootstrapLink = document.getElementById('bootstrap-css');
            if (bootstrapLink) {
                if (lang === 'ar') {
                    bootstrapLink.href = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.rtl.min.css';
                } else {
                    bootstrapLink.href = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css';
                }
            }
            
            // Adjust artifact details container alignment
            const detailsContainer = document.querySelector('.details-container');
            if (detailsContainer) {
                detailsContainer.style.textAlign = lang === 'ar' ? 'right' : 'left';
                detailsContainer.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
            }
            
            // Translate museum page header elements dynamically
            const urlParams = new URLSearchParams(window.location.search);
            const collId = urlParams.get('id') || currentMuseumCollection;
            const museumTitleHero = document.getElementById('museum-title-hero');
            if (museumTitleHero && collId) {
                let titleKey = '';
                if (collId.includes('tourism')) titleKey = 'tourism_title';
                else if (collId.includes('art')) titleKey = 'art_title';
                else if (collId.includes('science')) titleKey = 'science_title';
                
                if (titleKey && translations[lang] && translations[lang][titleKey]) {
                    museumTitleHero.innerText = translations[lang][titleKey];
                }
            }

            // Translate location text if it exists
            const locationEl = document.querySelector('.location');
            if (locationEl) {
                const locText = lang === 'ar' ? 'المنيا' : 'Minia';
                locationEl.innerHTML = `${locText} <i class="fas fa-map-marker-alt ms-1"></i>`;
            }

            // Align inputs dynamically based on text direction
            const searchInput = document.getElementById('artifact-search');
            if (searchInput) {
                searchInput.style.textAlign = lang === 'ar' ? 'right' : 'left';
            }
            const gallerySearchInput = document.getElementById('gallery-search');
            if (gallerySearchInput) {
                gallerySearchInput.style.textAlign = lang === 'ar' ? 'right' : 'left';
            }
            if (currentLangText) {
                const langNames = { ar: 'العربية', en: 'English', es: 'Español', fr: 'Français', it: 'Italiano' };
                currentLangText.innerText = langNames[lang] || 'العربية';
            }
            langSwitches.forEach(sw => {
                if(sw.getAttribute('data-lang') === lang) {
                    sw.classList.add('active');
                } else {
                    sw.classList.remove('active');
                }
            });
            
            // Apply translations
            const elements = document.querySelectorAll('[data-i18n]');
            elements.forEach(el => {
                const key = el.getAttribute('data-i18n');
                if (translations[lang] && translations[lang][key] !== undefined) {
                    el.innerText = translations[lang][key];
                }
            });
            
            // Translate placeholders
            const inputs = document.querySelectorAll('[data-i18n-placeholder]');
            inputs.forEach(el => {
                const key = el.getAttribute('data-i18n-placeholder');
                if (translations[lang] && translations[lang][key] !== undefined) {
                    el.placeholder = translations[lang][key];
                }
            });
        }; // end updateLanguage

        // Wire up language switch buttons
        langSwitches.forEach(sw => {
            sw.addEventListener('click', () => {
                const lang = sw.getAttribute('data-lang');
                if (lang) {
                    sessionStorage.setItem('lang', lang);
                    updateLanguage(lang);
                    // Re-render highlights with new language
                    const container = document.getElementById('highlights-container');
                    if (container && highlightsData.length > 0) renderHighlights(container);

                    // Re-render museum page elements if we are on museum.html
                    if (document.getElementById('artifacts-grid')) {
                        if (typeof currentMuseumCollection !== 'undefined' && currentMuseumCollection) {
                            if (currentMuseumCollection.includes('science')) {
                                if (typeof currentScienceSubMuseumId !== 'undefined' && currentScienceSubMuseumId) {
                                    const subNames = {
                                        geology: { ar: 'المتحف الجيولوجي', en: 'Geological Museum', fr: 'Musée Géologique' },
                                        zoology: { ar: 'متحف علم الحيوان', en: 'Zoology Museum', fr: 'Musée de Zoologie' }
                                    };
                                    const subTitle = subNames[currentScienceSubMuseumId] ? subNames[currentScienceSubMuseumId][lang] : '';
                                    loadScienceSubMuseum(currentScienceSubMuseumId, subTitle);
                                } else {
                                    renderScienceMuseums();
                                }
                            } else {
                                if (typeof museumArtifactsCache !== 'undefined' && museumArtifactsCache && museumArtifactsCache.length > 0) {
                                    renderArtifacts(museumArtifactsCache);
                                }
                            }
                        }
                    }

                    // Refresh dynamic elements on other pages if they exist
                    if (typeof window.renderGalleryGrid === 'function') {
                        window.renderGalleryGrid();
                    }
                    if (typeof window.renderFavorites === 'function') {
                        window.renderFavorites();
                    }
                    if (typeof window.renderItemDetails === 'function') {
                        const urlParams = new URLSearchParams(window.location.search);
                        const itemId = urlParams.get('id');
                        if (itemId) window.renderItemDetails(itemId);
                    }
                }
            });
        });

        // Apply saved language on page load
        const savedLang = sessionStorage.getItem('lang') || 'ar';
        updateLanguage(savedLang);

        // ========================================================
        // HIGHLIGHTS / STORIES SYSTEM
        // ========================================================
        const STORY_COLLECTIONS = [
            { id: 'minya_university_story', name: { en: 'Minia Univ', ar: 'جامعة المنيا', fr: 'Univ de Minia' } },
            { id: 'tourism_university_story', name: { en: 'Tourism', ar: 'السياحة', fr: 'Tourisme' } },
            { id: 'art_university_story', name: { en: 'Arts', ar: 'الفنون', fr: 'Arts' } },
            { id: 'zoology_story', name: { en: 'Zoology', ar: 'علم الحيوان', fr: 'Zoologie' } },
            { id: 'geo_story', name: { en: 'Geology', ar: 'الجيولوجيا', fr: 'Géologie' } },
            { id: 'store_story', name: { en: 'Store', ar: 'المتجر', fr: 'Boutique' } },
            { id: 'map_story', name: { en: 'Map', ar: 'الخريطة', fr: 'Carte' } }
        ];
        const STORY_IMG_BUCKET = '69f897e70035d17ec988';
        const STORY_VID_BUCKET = '69f8980600284abc5d0d';
        const STORY_DURATION_MS = 30 * 60 * 1000; // 30 minutes

        let highlightsData = [];
        let currentHighlightIndex = -1;
        let currentSlideIndex = 0;
        let storyTimeout = null;
        let progressInterval = null;
        let currentStartTime = 0;

    // Show skeleton placeholders immediately for instant UX
    function showHighlightSkeletons() {
        const container = document.getElementById('highlights-container');
        const section = document.getElementById('highlights-section');
        if (!container || !section) return;
        section.style.display = 'block';
        container.innerHTML = STORY_COLLECTIONS.map(() => `
            <div class="highlight-item">
                <div class="highlight-ring skeleton-ring">
                    <div class="highlight-skeleton-img"></div>
                </div>
                <div class="highlight-skeleton-title"></div>
            </div>
        `).join('');
    }

    // Keep reference to preloaded video elements so they buffer in background
    const videoPreloadElements = new Map();

    // Preload a video URL using a hidden <video> element for browser buffering
    function preloadVideoUrl(url) {
        if (!url || videoPreloadElements.has(url)) return;
        try {
            const v = document.createElement('video');
            v.preload = 'auto';
            v.muted = true;
            v.src = url;
            v.load();
            videoPreloadElements.set(url, v);
        } catch(e) {
            console.warn('Video preload failed:', url, e);
        }
    }

    // Preload all slides of each story to load them in advance for maximum speed
    function preloadStoryMedia(story) {
        if (!story || !story.slides || story.slides.length === 0) return;
        const lang = sessionStorage.getItem('lang') || 'ar';
        
        // Preload cover
        let cover = story.coverUrl;
        if (lang === 'en' && story.coverUrlEn) cover = story.coverUrlEn;
        else if (lang === 'fr' && story.coverUrlFr) cover = story.coverUrlFr;
        if (cover) preloadImageUrl(cover);

        // Preload all slides
        story.slides.forEach(slide => {
            if (slide.isVideo) {
                preloadVideoUrl(slide.url);
            } else {
                let imgUrl = slide.url;
                if (lang === 'en' && slide.urlEn) imgUrl = slide.urlEn;
                else if (lang === 'fr' && slide.urlFr) imgUrl = slide.urlFr;
                preloadImageUrl(imgUrl);
            }
        });
    }

    // Process one story collection's documents into slides + cover
    function processStoryDocs(docs) {
        let slides = [];
        let coverUrl = null;
        let coverUrlEn = null;
        let coverUrlFr = null;

        for (const doc of docs) {
            const isCover = doc['is_cover'];
            if (!coverUrl && isCover && isCover.length > 5) {
                coverUrl = `${AppwriteConfig.endpoint}/storage/buckets/${STORY_IMG_BUCKET}/files/${isCover}/preview?project=${AppwriteConfig.projectId}&width=200&height=200&gravity=center&quality=70`;
                
                // Check if this cover has English/French versions in the document
                const isCoverEn = doc['image-en'] || doc['Image-en'] || doc['image_en'] || doc['Image_en'];
                if (isCoverEn && isCoverEn.length > 5) {
                    coverUrlEn = `${AppwriteConfig.endpoint}/storage/buckets/${STORY_IMG_BUCKET}/files/${isCoverEn}/preview?project=${AppwriteConfig.projectId}&width=200&height=200&gravity=center&quality=70`;
                }
                const isCoverFr = doc['image-fr'] || doc['image_fr'];
                if (isCoverFr && isCoverFr.length > 5) {
                    coverUrlFr = `${AppwriteConfig.endpoint}/storage/buckets/${STORY_IMG_BUCKET}/files/${isCoverFr}/preview?project=${AppwriteConfig.projectId}&width=200&height=200&gravity=center&quality=70`;
                }
            }

            // Slide Image
            const imgArId = doc['image-ar'] || doc['image'] || doc['image_ar'];
            const imgEnId = doc['Image-en'] || doc['image-en'] || doc['image_en'] || doc['Image_en'];
            const imgFrId = doc['image-fr'] || doc['image_fr'];

            if (imgArId && imgArId.length > 5) {
                const urlAr = `${AppwriteConfig.endpoint}/storage/buckets/${STORY_IMG_BUCKET}/files/${imgArId}/view?project=${AppwriteConfig.projectId}`;
                const urlEn = imgEnId && imgEnId.length > 5 ? `${AppwriteConfig.endpoint}/storage/buckets/${STORY_IMG_BUCKET}/files/${imgEnId}/view?project=${AppwriteConfig.projectId}` : null;
                const urlFr = imgFrId && imgFrId.length > 5 ? `${AppwriteConfig.endpoint}/storage/buckets/${STORY_IMG_BUCKET}/files/${imgFrId}/view?project=${AppwriteConfig.projectId}` : null;

                slides.push({
                    url: urlAr,
                    urlEn: urlEn,
                    urlFr: urlFr,
                    isVideo: false
                });
            }

            // Slide Video
            let vidArId = null;
            const arVidKeys = ['video', 'vedio', 'video-id', 'videoId', 'video_url', 'video-url', 'videoFile', 'video_file', 'file', 'files', 'video_ar', 'video-en'];
            for (const key of arVidKeys) {
                let v = doc[key];
                if (typeof v !== 'string') v = Array.isArray(v) && v.length > 0 ? v[0] : null;
                if (v && typeof v === 'string' && v.length > 5) {
                    vidArId = v;
                    break;
                }
            }

            if (vidArId) {
                const urlAr = `${AppwriteConfig.endpoint}/storage/buckets/${STORY_VID_BUCKET}/files/${vidArId}/view?project=${AppwriteConfig.projectId}`;
                slides.push({
                    url: urlAr,
                    urlEn: null,
                    urlFr: null,
                    isVideo: true
                });
            }
        }

        // Cover fallback
        if (!coverUrl && slides.length > 0) {
            const firstImg = slides.find(s => !s.isVideo);
            if (firstImg) {
                coverUrl = firstImg.url;
                coverUrlEn = firstImg.urlEn;
                coverUrlFr = firstImg.urlFr;
            } else {
                coverUrl = slides[0].url;
            }
        }

        return { slides, coverUrl, coverUrlEn, coverUrlFr };
    }

    async function loadHighlights() {
        // Ensure Appwrite is initialized
        if (!databases) {
            let waited = 0;
            while (!databases && waited < 3000) {
                await new Promise(r => setTimeout(r, 100));
                if (!databases) initAppwrite();
                waited += 100;
            }
            if (!databases) { console.warn('Highlights: Appwrite not ready'); return; }
        }

        const container = document.getElementById('highlights-container');
        if (!container) return;

        // Try load from Cache
        const cachedHighlights = localStorage.getItem('cached_highlights_v1');
        if (cachedHighlights) {
            try {
                highlightsData = JSON.parse(cachedHighlights);
                if (highlightsData && highlightsData.length > 0) {
                    document.getElementById('highlights-section').style.display = 'block';
                    renderHighlights(container);
                    // Background preload cached media in background
                    setTimeout(() => {
                        highlightsData.forEach(story => preloadStoryMedia(story));
                    }, 200);
                }
            } catch (e) {
                console.warn('Failed to parse cached highlights:', e);
            }
        }

        if (highlightsData.length === 0) {
            showHighlightSkeletons();
        }

        try {
            // Fetch ALL story collections in PARALLEL
            const results = await Promise.allSettled(
                STORY_COLLECTIONS.map(coll =>
                    databases.listDocuments(AppwriteConfig.databaseId, coll.id)
                        .then(res => ({ coll, docs: res.documents || [] }))
                        .catch(() => ({ coll, docs: [] }))
                )
            );

            // Process results preserving STORY_COLLECTIONS order
            const newData = [];
            for (const result of results) {
                if (result.status !== 'fulfilled') continue;
                const { coll, docs } = result.value;
                if (!docs.length) continue;
                const { slides, coverUrl, coverUrlEn, coverUrlFr } = processStoryDocs(docs);
                if (slides.length > 0) {
                    newData.push({
                        title: coll.name,
                        coverUrl,
                        coverUrlEn,
                        coverUrlFr,
                        slides,
                        viewed: false
                    });
                }
            }

            const dataString = JSON.stringify(newData);
            if (dataString !== JSON.stringify(highlightsData)) {
                highlightsData = newData;
                localStorage.setItem('cached_highlights_v1', dataString);

                if (highlightsData.length > 0) {
                    document.getElementById('highlights-section').style.display = 'block';
                    renderHighlights(container);
                    // Background preload story media (images + videos) after render
                    setTimeout(() => {
                        highlightsData.forEach(story => preloadStoryMedia(story));
                    }, 500);
                } else {
                    document.getElementById('highlights-section').style.display = 'none';
                }
            }
        } catch (err) {
            console.error('Highlights Appwrite load failed:', err);
        }
    }

    function renderHighlights(container) {
        container.innerHTML = '';
        const lang = sessionStorage.getItem('lang') || 'ar';
        highlightsData.forEach((story, idx) => {
            let currentCover = story.coverUrl;
            if (lang === 'en' && story.coverUrlEn) currentCover = story.coverUrlEn;
            else if (lang === 'fr' && story.coverUrlFr) currentCover = story.coverUrlFr;

            const el = document.createElement('div');
            el.className = 'highlight-item';
            el.innerHTML = `
                <div class="highlight-ring ${story.viewed ? 'viewed' : ''}" id="ring-${idx}">
                    <img src="${currentCover}" alt="${story.title[lang]}">
                </div>
                <div class="highlight-title">${story.title[lang]}</div>
            `;
            el.addEventListener('click', () => openStory(idx));
            container.appendChild(el);
        });
    }

    function openStory(index) {
        if (index < 0 || index >= highlightsData.length) return closeStory();
        currentHighlightIndex = index;
        currentSlideIndex = 0;
        const story = highlightsData[currentHighlightIndex];
        story.viewed = true;
        
        // Preload ALL slides of the active story now that the user is viewing it
        const lang = sessionStorage.getItem('lang') || 'ar';
        story.slides.forEach(slide => {
            if (slide.isVideo) {
                preloadVideoUrl(slide.url);
            } else {
                let imgUrl = slide.url;
                if (lang === 'en' && slide.urlEn) imgUrl = slide.urlEn;
                else if (lang === 'fr' && slide.urlFr) imgUrl = slide.urlFr;
                preloadImageUrl(imgUrl);
            }
        });

        const ring = document.getElementById(`ring-${index}`);
        if (ring) ring.classList.add('viewed');

        const modal = document.getElementById('story-modal');
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        document.getElementById('story-title').innerText = story.title[lang];

        let currentCover = story.coverUrl;
        if (lang === 'en' && story.coverUrlEn) currentCover = story.coverUrlEn;
        else if (lang === 'fr' && story.coverUrlFr) currentCover = story.coverUrlFr;
        document.getElementById('story-avatar').src = currentCover;

        setupProgressBars(story.slides.length);
        renderSlide();
    }

    function setupProgressBars(count) {
        const container = document.getElementById('story-progress-container');
        container.innerHTML = '';
        for (let i = 0; i < count; i++) {
            const seg = document.createElement('div');
            seg.className = 'story-progress-segment';
            seg.innerHTML = `<div class="story-progress-fill" id="progress-fill-${i}"></div>`;
            container.appendChild(seg);
        }
    }

    function renderSlide() {
        if (currentHighlightIndex === -1) return;
        const story = highlightsData[currentHighlightIndex];
        const slide = story.slides[currentSlideIndex];
        const contentArea = document.getElementById('story-content');
        contentArea.innerHTML = '';

        // Reset all progress bars up to current
        for (let i = 0; i < story.slides.length; i++) {
            const fill = document.getElementById(`progress-fill-${i}`);
            if (!fill) continue;
            if (i < currentSlideIndex) fill.style.width = '100%';
            else fill.style.width = '0%';
        }

        clearTimeout(storyTimeout);
        clearInterval(progressInterval);

        const lang = sessionStorage.getItem('lang') || 'ar';

        if (slide.isVideo) {
            const video = document.createElement('video');
            video.preload = 'auto';
            video.autoplay = true;
            video.loop = false; // Do not loop to allow ended event to fire
            video.muted = false;
            video.playsInline = true;
            video.controls = false;
            
            // Add loading spinner overlaid on top of video
            contentArea.innerHTML = '<div class="story-video-loader"><i class="fas fa-spinner fa-spin"></i></div>';
            contentArea.appendChild(video);

            const loader = contentArea.querySelector('.story-video-loader');
            
            video.addEventListener('playing', () => {
                if (loader) loader.remove();
            }, { once: true });

            video.addEventListener('canplay', () => {
                if (loader) loader.remove();
                video.play().catch(err => {
                    // Autoplay blocked — mute and retry
                    console.warn('Autoplay blocked, muting:', err);
                    video.muted = true;
                    video.play().catch(e2 => console.warn('Muted play failed:', e2));
                });
            }, { once: true });
            
            video.addEventListener('error', (e) => {
                // Video failed: show error and advance to next slide
                console.warn('Story video error, skipping slide:', slide.url, video.error);
                contentArea.innerHTML = '<div class="story-video-error"><i class="fas fa-exclamation-triangle"></i><span>تعذّر تشغيل الفيديو</span></div>';
                setTimeout(() => nextSlide(), 2000);
            }, { once: true });

            // Listen to metadata to setup dynamic progress interval
            video.addEventListener('loadedmetadata', () => {
                const duration = video.duration || 10;
                clearInterval(progressInterval);
                progressInterval = setInterval(() => {
                    if (video.paused) return;
                    let pct = (video.currentTime / duration) * 100;
                    if (pct > 100) pct = 100;
                    const fill = document.getElementById(`progress-fill-${currentSlideIndex}`);
                    if (fill) fill.style.width = pct + '%';
                }, 50);
            });

            // Update on timeupdate for high precision
            video.addEventListener('timeupdate', () => {
                if (video.duration) {
                    let pct = (video.currentTime / video.duration) * 100;
                    if (pct > 100) pct = 100;
                    const fill = document.getElementById(`progress-fill-${currentSlideIndex}`);
                    if (fill) fill.style.width = pct + '%';
                }
            });

            // Auto advance when video ends
            video.addEventListener('ended', () => {
                nextSlide();
            });
            
            video.src = slide.url;
            video.load();
        } else {
            // Get lang-specific image URL
            let imgUrl = slide.url;
            if (lang === 'en' && slide.urlEn) imgUrl = slide.urlEn;
            else if (lang === 'fr' && slide.urlFr) imgUrl = slide.urlFr;

            const img = document.createElement('img');
            img.src = imgUrl;
            img.onerror = () => {
                console.warn('Story image error, skipping slide:', imgUrl);
                setTimeout(() => nextSlide(), 1000);
            };
            contentArea.appendChild(img);

            // Set fixed 7s duration for images
            const slideDuration = 7000;
            currentStartTime = Date.now();
            progressInterval = setInterval(() => {
                const elapsed = Date.now() - currentStartTime;
                let pct = (elapsed / slideDuration) * 100;
                if (pct > 100) pct = 100;
                const fill = document.getElementById(`progress-fill-${currentSlideIndex}`);
                if (fill) fill.style.width = pct + '%';
            }, 50);

            storyTimeout = setTimeout(() => {
                nextSlide();
            }, slideDuration);
        }

        // Preload next slide proactively
        const nextIdx = currentSlideIndex + 1;
        if (nextIdx < story.slides.length) {
            const nextSlideData = story.slides[nextIdx];
            if (nextSlideData.isVideo) {
                preloadVideoUrl(nextSlideData.url);
            } else {
                let nextImgUrl = nextSlideData.url;
                if (lang === 'en' && nextSlideData.urlEn) nextImgUrl = nextSlideData.urlEn;
                else if (lang === 'fr' && nextSlideData.urlFr) nextImgUrl = nextSlideData.urlFr;
                preloadImageUrl(nextImgUrl);
            }
        }
    }

    function nextSlide() {
        if (currentHighlightIndex === -1) return;
        const story = highlightsData[currentHighlightIndex];
        if (currentSlideIndex < story.slides.length - 1) {
            currentSlideIndex++;
            renderSlide();
        } else {
            closeStory(); // Close the story completely when slides finish, do not auto-advance to next highlight
        }
    }

    function prevSlide() {
        if (currentHighlightIndex === -1) return;
        if (currentSlideIndex > 0) {
            currentSlideIndex--;
            renderSlide();
        } else {
            if (currentHighlightIndex > 0) {
                openStory(currentHighlightIndex - 1);
                // Go to last slide of prev story
                currentSlideIndex = highlightsData[currentHighlightIndex].slides.length - 1;
                renderSlide();
            } else {
                currentSlideIndex = 0;
                renderSlide();
            }
        }
    }

    function closeStory() {
        clearTimeout(storyTimeout);
        clearInterval(progressInterval);
        
        // Explicitly pause and stop any running videos to ensure they close completely
        const contentArea = document.getElementById('story-content');
        if (contentArea) {
            const videos = contentArea.getElementsByTagName('video');
            for (let video of videos) {
                video.pause();
                video.src = '';
                try {
                    video.load();
                } catch(e) {}
            }
            contentArea.innerHTML = ''; // Stop video
        }
        
        currentHighlightIndex = -1;
        currentSlideIndex = 0;
        
        const modal = document.getElementById('story-modal');
        if (modal) {
            modal.classList.remove('active');
        }
        document.body.style.overflow = 'auto';
    }

    const nextZone = document.getElementById('story-next-zone');
    const prevZone = document.getElementById('story-prev-zone');
    const closeBtn = document.getElementById('story-close-btn');

    if (nextZone) nextZone.addEventListener('click', nextSlide);
    if (prevZone) prevZone.addEventListener('click', prevSlide);
    if (closeBtn) closeBtn.addEventListener('click', closeStory);

    // Click outside (backdrop) closes story
    const backdrop = document.getElementById('story-backdrop');
    if (backdrop) backdrop.addEventListener('click', closeStory);

    // Keyboard: ESC = close, ArrowLeft = prev, ArrowRight = next
    document.addEventListener('keydown', (e) => {
        const modal = document.getElementById('story-modal');
        if (!modal || !modal.classList.contains('active')) return;
        if (e.key === 'Escape')     closeStory();
        if (e.key === 'ArrowLeft')  prevSlide();
        if (e.key === 'ArrowRight') nextSlide();
    });

    // Load highlights IMMEDIATELY — no delay
    loadHighlights();
});