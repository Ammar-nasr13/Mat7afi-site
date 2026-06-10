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
const _aw_key = "eyJlbmRwb2ludCI6Imh0dHBzOi8vYXBwd3JpdGUuZXRpaGFkYWxtZGluYS5jb20vdjEiLCJwcm9qZWN0SWQiOiI2OWYyMWM3MzAwMDYyMTkzOTQyMiIsImRhdGFiYXNlSWQiOiI2OWY2OTk0ODAwMTBlMmZlZWE4YSIsImNvbGxlY3Rpb25zIjp7InRvdXJpc20iOiJ0b3VyaXNtX2FydGlmYWN0cyIsInNjaWVuY2UiOiJzY2llbmNlX2F0aWZhY3RzIiwiYXJ0IjoiYXJ0X2F0aWZhY3RzIiwiYWN0aXZhdGlvbiI6ImFjdGl2YXRpb25fY29kZXMifSwiYnVja2V0cyI6eyJ0b3VyaXNtIjoiNjlmN2Q2OGMwMDM4MjE5OTdkMGQiLCJhcnRpZmFjdHMiOiI2OWY2ODZlOTAwMmY5MTdlYzJhMiIsImF1ZGlvIjoiNjlmODcwYzAwMDBlYjM5NjkyNjAiLCJhcnRJbWFnZXMiOiI2OWZkZmE2NjAwMmQxYTkxMDZmNyIsInNjaWVuY2VJbWFnZXMiOiI2OWZkZmE4MDAwMmYwZGI4M2M2NyIsImFyTW9kZWxzIjoiNmExM2NmMzcwMDE3ZDRmZjcwMDYifX0=";
const AppwriteConfig = JSON.parse(atob(_aw_key));

let databases;
let museumArtifactsCache = [];
let currentMuseumCollection = '';
let currentMuseumName = '';

let Query;
// Appwrite initialization helper (deferred to DOMContentLoaded to avoid race)
function initAppwrite() {
    if (typeof Appwrite === 'undefined') {
        console.warn('Appwrite SDK not available yet. Initialization deferred.');
        return false;
    }

    const { Client, Databases, Query: AppwriteQuery } = Appwrite;
    const client = new Client();
    client
        .setEndpoint(AppwriteConfig.endpoint)
        .setProject(AppwriteConfig.projectId);
    databases = new Databases(client);
    Query = AppwriteQuery;
    return true;
}

// Gemini API Configuration Caching
let cachedGeminiConfig = null;
window.getGeminiConfig = async () => {
    if (cachedGeminiConfig) return cachedGeminiConfig;
    try {
        const response = await databases.listDocuments(
            AppwriteConfig.databaseId,
            'appconfig'
        );
        if (response && response.documents && response.documents.length > 0) {
            const configDoc = response.documents[0];
            cachedGeminiConfig = {
                apiKey: configDoc.gemini_api || configDoc.gemini_api_key,
                model: configDoc.gemini_model || 'gemini-1.5-pro'
            };
            return cachedGeminiConfig;
        }
    } catch (e) {
        console.error('Error fetching Gemini Config from appconfig', e);
    }
    return null;
};

window.getGeminiApiKey = async () => {
    const config = await window.getGeminiConfig();
    return config ? config.apiKey : null;
};

// Global Core Functions
const getCurrentLang = () => sessionStorage.getItem('lang') || 'ar';

const getArtifactTitle = (artifact) => {
    const lang = getCurrentLang();
    return artifact[`name-${lang}`] || artifact['name-ar'] || artifact.name || artifact.title || 'قطعة أثرية';
};

const getArtifactDescription = (artifact) => {
    const lang = getCurrentLang();
    return artifact[`description-${lang}`] || artifact['description-ar'] || artifact.description || artifact.desc || '';
};

// Helpers
function getBucketByType(collectionId) {
    if (!collectionId) return AppwriteConfig.buckets.tourism;
    if (collectionId.includes('science') || collectionId.includes('art_')) {
        return AppwriteConfig.buckets.artifacts; 
    }
    return AppwriteConfig.buckets.tourism;
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

function setupImageFallback(imgEl, fileId) {
    if (!imgEl) return;
    if (!fileId) {
        imgEl.style.display = 'none';
        const card = imgEl.closest('.artifact-card');
        if (card) card.classList.add('no-image');
        return;
    }
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

    const fragment = document.createDocumentFragment();

    artifacts.forEach((artifact) => {
        const bucketId = getBucketByType(currentMuseumCollection);
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
        col.className = 'col-lg-4 col-md-6 col-sm-6 col-12 mb-5';

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

        fragment.appendChild(col);
        const img = col.querySelector('img');
        setupImageFallback(img, artifact.image || artifact.image_url);
    });

    artifactsGrid.appendChild(fragment);
};

// Global Page Initializers
window.initMuseumPage = async (collectionId, museumName, museumImg) => {
    const artifactsGrid = document.getElementById('artifacts-grid');
    const museumTitleHero = document.getElementById('museum-title-hero');
    const museumHeroImg = document.getElementById('museum-hero-img');

    if (!artifactsGrid) return;
    
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
            else if (collectionId.includes('science')) museumHeroImg.src = 'assets/science-museum.png';
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
        
        // Background Preloading of Images
        if (museumArtifactsCache.length > 0) {
            const bucketId = getBucketByType(collectionId);
            setTimeout(() => {
                museumArtifactsCache.forEach(artifact => {
                    const imgUrl = getAppwriteImageUrl(artifact.image || artifact.image_url, bucketId);
                    if (imgUrl) {
                        const img = new Image();
                        img.src = imgUrl;
                    }
                });
            }, 100);
        }
        
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
        { id: 1, color: '#0a192f', ar: 'القاعة الأولى', en: 'First Hall', fr: 'Première Salle' },
        { id: 2, color: '#5c3a21', ar: 'القاعة الثانية', en: 'Second Hall', fr: 'Deuxième Salle' },
        { id: 3, color: '#0a192f', ar: 'القاعة الثالثة', en: 'Third Hall', fr: 'Troisième Salle' },
        { id: 4, color: '#5c3a21', ar: 'القاعة الرابعة', en: 'Fourth Hall', fr: 'Quatrième Salle' }
    ];

    halls.forEach(hall => {
        const title = hall[lang] || hall.ar;
        const col = document.createElement('div');
        col.className = 'col-md-6 col-12 mb-4';
        
        col.innerHTML = `
            <a href="javascript:void(0)" onclick="filterArtByHall(${hall.id}, '${title}')" style="text-decoration:none; display: block;">
                <div style="background-color: ${hall.color}; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; height: 160px; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(0,0,0,0.2);" 
                     onmouseover="this.style.transform='translateY(-5px)'; this.style.boxShadow='0 10px 25px rgba(0,0,0,0.3)'; this.style.borderColor='rgba(217, 119, 6, 0.5)';" 
                     onmouseout="this.style.transform='none'; this.style.boxShadow='0 4px 15px rgba(0,0,0,0.2)'; this.style.borderColor='rgba(255,255,255,0.1)';">
                    <h3 style="color: #ffffff; font-size: 2rem; font-weight: 800; margin: 0; font-family: 'Cairo', sans-serif;">${title}</h3>
                </div>
            </a>
        `;
        fragment.appendChild(col);
    });

    artifactsGrid.appendChild(fragment);
};

window.renderScienceMuseums = () => {
    const artifactsGrid = document.getElementById('artifacts-grid');
    const backToHallsBtn = document.getElementById('back-to-halls-btn');
    if (!artifactsGrid) return;
    
    if (backToHallsBtn) backToHallsBtn.style.display = 'none';
    
    const lang = getCurrentLang();
    artifactsGrid.innerHTML = '';
    const fragment = document.createDocumentFragment();

    const museums = [
        { 
            id: 'zoology', 
            img: 'assets/science-museum.png', 
            ar: 'متحف علم الحيوان', 
            en: 'Zoology Museum', 
            fr: 'Musée de Zoologie',
            desc_ar: 'اكتشف تنوع الكائنات الحية وتطورها. <span style="display:block; font-size:0.75rem; opacity:0.4; margin-top:5px;">* نماذج محاكاة رقمية للعرض</span>',
            desc_en: 'Discover the diversity of living organisms. <span style="display:block; font-size:0.75rem; opacity:0.4; margin-top:5px;">* Digital simulation models</span>',
            desc_fr: 'Découvrez la diversité des organismes vivants. <span style="display:block; font-size:0.75rem; opacity:0.4; margin-top:5px;">* Modèles de simulation numérique</span>',
            cat_ar: 'علم الحيوان', cat_en: 'Zoology', cat_fr: 'Zoologie'
        },
        { 
            id: 'biology', 
            img: 'assets/science-museum1.png', 
            ar: 'متحف البيولوجي', 
            en: 'Biology Museum', 
            fr: 'Musée de Biologie',
            desc_ar: 'رحلة في أعماق الطبيعة والخلايا الحية. <span style="display:block; font-size:0.75rem; opacity:0.4; margin-top:5px;">* نماذج محاكاة رقمية للعرض</span>',
            desc_en: 'A journey into the depths of nature and living cells. <span style="display:block; font-size:0.75rem; opacity:0.4; margin-top:5px;">* Digital simulation models</span>',
            desc_fr: 'Un voyage dans les profondeurs de la nature et des cellules. <span style="display:block; font-size:0.75rem; opacity:0.4; margin-top:5px;">* Modèles de simulation numérique</span>',
            cat_ar: 'البيولوجيا', cat_en: 'Biology', cat_fr: 'Biologie'
        }
    ];

    museums.forEach(museum => {
        const title = museum[lang] || museum.ar;
        const desc = museum[`desc_${lang}`] || museum.desc_ar;
        const cat = museum[`cat_${lang}`] || museum.cat_ar;
        const exploreText = lang === 'en' ? 'Explore Pieces' : (lang === 'fr' ? 'Explorer les pièces' : 'استكشف القطع');
        
        const col = document.createElement('div');
        col.className = 'col-lg-5 col-md-6 col-12 mb-5 mx-auto';
        
        col.innerHTML = `
            <div class="museum-card" onclick="showScienceComingSoon('${title}')" style="min-height: 450px; height: 100%; background: #1e293b; border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; overflow: hidden; display: flex; flex-direction: column; cursor: pointer; transition: transform 0.3s ease, box-shadow 0.3s ease;" onmouseover="this.style.transform='scale(1.02)'; this.style.boxShadow='0 12px 25px rgba(0,0,0,0.4)';" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 8px 15px rgba(0,0,0,0.2)';">
                <div style="width: 100%; height: 250px; overflow: hidden; flex-shrink: 0;">
                    <img src="${museum.img}" alt="${title}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease;" loading="eager" fetchpriority="high" onmouseover="this.style.transform='scale(1.05)';" onmouseout="this.style.transform='scale(1)';">
                </div>
                <div style="padding: 20px 25px; flex-grow: 1; display: flex; flex-direction: column; justify-content: center; text-align: right;">
                    <span style="color: #d4af37; font-size: 0.9rem; font-weight: 700; display: block; margin-bottom: 8px;">${cat}</span>
                    <h3 style="color: #ffffff; font-size: 1.5rem; font-weight: 800; margin-bottom: 12px;">${title}</h3>
                    <p style="color: rgba(255, 255, 255, 0.7); font-size: 0.95rem; line-height: 1.6; margin-bottom: 20px;">${desc}</p>
                    <span style="color: #d4af37; font-weight: 700; display: inline-flex; align-items: center; gap: 8px; font-size: 1rem; margin-top: auto;">
                        <span>${exploreText}</span> 
                        <i class="fas fa-arrow-left"></i>
                    </span>
                </div>
            </div>
        `;
        fragment.appendChild(col);
    });

    artifactsGrid.appendChild(fragment);
};

window.showScienceComingSoon = (museumTitle) => {
    const artifactsGrid = document.getElementById('artifacts-grid');
    const backToHallsBtn = document.getElementById('back-to-halls-btn');
    const lang = getCurrentLang();
    
    const backBtnText = lang === 'en' ? 'Back to Museums' : (lang === 'fr' ? 'Retour aux Musées' : 'العودة للمتاحف');
    if (backToHallsBtn) {
        backToHallsBtn.innerHTML = `
            <button class="btn btn-outline-light rounded-pill px-4 py-2" onclick="renderScienceMuseums()">
                <i class="fas fa-arrow-right me-2"></i> ${backBtnText}
            </button>
            <h3 class="text-white mt-3">${museumTitle}</h3>
        `;
        backToHallsBtn.style.display = 'block';
    }

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 2);
    
    const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    const formattedDate = targetDate.toLocaleDateString(
        lang === 'en' ? 'en-US' : (lang === 'fr' ? 'fr-FR' : 'ar-EG'), 
        dateOptions
    );

    const soonMsg = lang === 'en' ? `The museum pieces will be available soon by ${formattedDate}` : 
                    (lang === 'fr' ? `Les pièces du musée seront bientôt disponibles d'ici le ${formattedDate}` : 
                    `سيتم توفير قطع المتحف قريباً بحلول ${formattedDate}`);

    artifactsGrid.innerHTML = `
        <div class="col-12 text-center py-5">
            <div class="mobile-info-card" style="background: rgba(0,0,0,0.05); padding: 50px 30px; border-radius: 20px;">
                <i class="fas fa-tools text-warning mb-4" style="font-size: 4rem;"></i>
                <h2 class="text-dark mb-3" style="font-weight: bold;">${soonMsg}</h2>
                <p class="text-secondary">نعمل بجد لإضافة القطع الخاصة بهذا المتحف لتجربة مميزة.</p>
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
            <button class="btn btn-outline-light rounded-pill px-4 py-2" onclick="renderArtHalls()">
                <i class="fas fa-arrow-right me-2"></i> ${backBtnText}
            </button>
            <h3 class="text-white mt-3">${hallTitle}</h3>
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

    if (loader) loader.style.display = 'block';
    if (artifactContent) artifactContent.style.display = 'none';

    try {
        let artifact = await databases.getDocument(AppwriteConfig.databaseId, collectionId, documentId);
        const lang = getCurrentLang();
        
        let name = getArtifactTitle(artifact);
        let subtitle = '';

        if (collectionId.includes('tourism')) {
            subtitle = artifact[`era-${lang}`] || artifact['era-ar'] || artifact.era || 'عصر غير محدد';
        } else if (collectionId.includes('art_')) {
            const hallName = artifact[`nameh-${lang}`] || artifact['nameh-ar'] || artifact.nameh || (lang === 'en' ? `Hall ${artifact['art-id']}` : `القاعة ${artifact['art-id']}`);
            const author = artifact[`author-${lang}`] || artifact['author-ar'] || artifact.author || (lang === 'en' ? 'Unknown Artist' : (lang === 'fr' ? 'Artiste inconnu' : 'فنان غير معروف'));
            name = hallName;
            subtitle = author;
        } else if (collectionId.includes('science')) {
            subtitle = artifact[`category-${lang}`] || artifact['category-ar'] || artifact.category || 'تصنيف علمي';
        }
        
        if (artifactNameHero) artifactNameHero.innerText = name;
        if (artifactSubtitleHero) artifactSubtitleHero.innerText = subtitle;

        const bucketId = getBucketByType(collectionId);
        const imgUrl = getAppwriteImageUrl(artifact.image || artifact.image_url, bucketId);
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
            } else {
                sectionTitles[0].innerText = lang === 'en' ? 'Identification Card' : (lang === 'fr' ? 'Carte d\'identité' : 'بطاقة التعريف');
            }
            sectionTitles[1].innerText = lang === 'en' ? 'Description' : (lang === 'fr' ? 'Description' : 'الوصف');
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
            en: { museum: 'Museum: :', category: 'Category: :', era: 'data: :', location: 'Provenance: :', material: 'Material: :', dimensions: 'Dimensions: :', author: 'Artist: :', serial: 'Serial Number: :', size: 'Size: :', type: 'Type: :', hall: 'Hall: :' },
            fr: { museum: 'Musée: :', category: 'Catégorie: :', era: 'Époque: :', location: 'Provenance: :', material: 'Matériel: :', dimensions: 'Dimensions: :', author: 'Artiste: :', serial: 'Numéro de série: :', size: 'Taille: :', type: 'Type: :', hall: 'Salle: :' }
        };
        const l = labels[lang] || labels.ar;

        // Populate Info Grid
        if (infoGrid) {
            infoGrid.innerHTML = '';
            
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
        const audioFileId = artifact[`audio-${lang}`] || artifact[`audio_${lang}`] || artifact['audio-ar'] || artifact.audio_ar || '';
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

        // 360 GLB Model Logic
        const btn360Wrap = document.getElementById('btn-360-wrap');
        const btn360Element = document.getElementById('btn-360-element');
        const glbFileId = artifact.glbFileId || artifact.glbFileld || artifact.glb_file_id || '';
        if (glbFileId && btn360Wrap && btn360Element) {
            btn360Wrap.style.display = 'block';
            const handle360Click = () => {
                const modelBucketId = AppwriteConfig.buckets.arModels;
                const modelUrl = getAppwriteImageUrl(glbFileId, modelBucketId);
                window.location.href = `viewer3d.html?url=${encodeURIComponent(modelUrl)}&title=${encodeURIComponent(name)}`;
            };
            btn360Element.onclick = handle360Click;

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
    }
});

async function handleChat() {
    const userInput = document.getElementById('user-input');
    const chatMessages = document.getElementById('chat-messages');
    if (!userInput || !chatMessages) return;

    const text = userInput.value.trim();
    if (!text) return;
    
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

    const SYSTEM_PROMPT = lang === 'en' 
        ? "You are Ego Pro, a smart assistant expert in Minia University Museums. Answer professionally, concisely, and in detail in English."
        : (lang === 'fr'
            ? "Vous êtes Ego Pro, un assistant intelligent expert des musées de l'Université de Minia. Répondez de manière professionnelle, concise et détaillée en français."
            : "أنت Ego Pro، مساعد ذكي خبير في متاحف جامعة المنيا. أجب باحترافية وبشكل مفصل باللغة العربية.");

    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                contents: [{ 
                    parts: [
                        { text: SYSTEM_PROMPT },
                        { text: text }
                    ] 
                }] 
            })
        });
        
        const data = await res.json();
        thinking.remove();
        
        if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts) {
            const responseText = data.candidates[0].content.parts[0].text;
            addMsg(responseText, 'system');
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
                "ai_status": "Ego Pro is Online",
                "ai_desc": "Chat with our smart assistant powered by OpenAI for precise information.",
                "ai_active": "Active AI System",
                "ai_welcome": "Welcome! I am Ego Pro, your smart guide. How can I help you today?",
                "ai_placeholder": "Ask me about any artifact...",
                "download_title": "Carry the Museums in your Pocket",
                "download_desc": "Get the full experience through the official app. Available soon on official stores and available now for direct download.",
                "download_direct": "Direct Download (Device Versions)",
                "download_direct_desc": "You can download the appropriate file for your device and install it directly.",
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
                "ai_status": "إيجو برو متصل الآن",
                "ai_desc": "تحدث مع مساعدنا الذكي المدعوم من OpenAI للحصول على معلومات دقيقة.",
                "ai_active": "نظام ذكاء اصطناعي نشط",
                "ai_welcome": "مرحباً بك! أنا Ego Pro مرشدك الذكي. كيف يمكنني مساعدتك اليوم؟",
                "ai_placeholder": "اسألني عن أي قطعة أثرية...",
                "download_title": "احمل المتاحف في جيبك",
                "download_desc": "احصل على التجربة الكاملة عبر التطبيق الرسمي. متوفر قريباً على المتاجر الرسمية ومتاح الآن للتحميل المباشر.",
                "download_direct": "تحميل مباشر (إصدارات الأجهزة)",
                "download_direct_desc": "يمكنك تحميل الملف المناسب لنوع جهازك وتثبيته مباشرة.",
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
                "ai_status": "Ego Pro est En Ligne",
                "ai_desc": "Discutez avec notre assistant intelligent propulsé par OpenAI pour des informations précises.",
                "ai_active": "Système IA Actif",
                "ai_welcome": "Bienvenue ! Je suis Ego Pro, votre guide intelligent. Comment puis-je vous aider aujourd'hui ?",
                "ai_placeholder": "Interrogez-moi sur n'importe quel artefact...",
                "download_title": "Transportez les Musées dans votre Poche",
                "download_desc": "Obtenez l'expérience complète via l'application officielle. Disponible bientôt.",
                "download_direct": "Téléchargement Direct",
                "download_direct_desc": "Vous pouvez télécharger le fichier approprié pour votre appareil et l'installer directement.",
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

            // Switch Bootstrap CSS based on language
            const bsLinkLtr = document.getElementById('bootstrap-css-ltr');
            const bsLinkRtl = document.getElementById('bootstrap-css-rtl');
            if (bsLinkLtr && bsLinkRtl) {
                bsLinkLtr.disabled = lang === 'ar';
                bsLinkRtl.disabled = lang !== 'ar';
            } else {
                const bsLink = document.getElementById('bootstrap-css');
                if (bsLink) {
                    const newHref = lang === 'ar' 
                        ? 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.rtl.min.css' 
                        : 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css';
                    if (bsLink.getAttribute('href') !== newHref) {
                        bsLink.href = newHref;
                    }
                }
            }
            
            // Adjust icons direction if needed
            const heroArrow = document.getElementById('hero-arrow');
            if (heroArrow) {
                heroArrow.className = lang === 'ar' ? 'fas fa-arrow-left ms-2' : 'fas fa-arrow-right ms-2';
            }
            
            const cardArrows = document.querySelectorAll('.arrow-dir');
            cardArrows.forEach(arrow => {
                arrow.className = lang === 'ar' ? 'fas fa-arrow-left arrow-dir' : 'fas fa-arrow-right arrow-dir';
            });

            // Re-render currently viewed artifacts/halls to update language immediately
            if (typeof renderArtifacts === 'function' && typeof museumArtifactsCache !== 'undefined' && museumArtifactsCache.length > 0) {
                renderArtifacts(museumArtifactsCache);
            }
            if (typeof renderScienceMuseums === 'function' && typeof currentMuseumCollection !== 'undefined' && currentMuseumCollection.includes('science')) {
                renderScienceMuseums();
            }
            if (typeof renderArtHalls === 'function' && typeof currentMuseumCollection !== 'undefined' && currentMuseumCollection.includes('art_')) {
                renderArtHalls();
            }
            
            // If we are on artifact page, we need to re-render info grid
            if (window.location.pathname.includes('artifact.html')) {
                const urlParams = new URLSearchParams(window.location.search);
                const documentId = urlParams.get('id');
                const collectionId = urlParams.get('collection');
                const museumName = urlParams.get('museum');
                if (window.initArtifactPage) {
                    window.initArtifactPage(documentId, collectionId, museumName);
                }
            }
        };

        // Default to Arabic
        const savedLang = sessionStorage.getItem('lang') || 'ar';
        updateLanguage(savedLang);

        langSwitches.forEach(sw => {
            sw.addEventListener('click', (e) => {
                e.preventDefault();
                const newLang = sw.getAttribute('data-lang');
                sessionStorage.setItem('lang', newLang);
                updateLanguage(newLang);
            });
        });

    // Mobile Bottom Nav Instant Active State
    const bottomNavItems = document.querySelectorAll('.nav-item-bottom');
    bottomNavItems.forEach(item => {
        item.addEventListener('click', function() {
            bottomNavItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // Aggressive Background Preloader for Images
    setTimeout(() => {
        const imagesToPreload = [
            'assets/tourism-museum.jpg',
            'assets/artt-museum.jpg',
            'assets/متاحف كلية علوم.png',
            'assets/science-museum.png',
            'assets/science-museum1.png',
            'assets/Frame 1.png',
            'assets/Frame 2.png',
            'assets/Frame 3.png',
            'assets/Frame 4.png',
            'assets/Desktop  2.png'
        ];
        imagesToPreload.forEach(src => {
            const img = new Image();
            img.src = src;
        });
    }, 2000);
});