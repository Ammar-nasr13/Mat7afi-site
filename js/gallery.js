// Dictionary for display names
const museumNames = {
    'tourism_museum': 'متحف كلية السياحة والفنادق',
    'science_museum': 'متحف العلوم',
    'modern_art_museum': 'متحف الفن الحديث',
    'all': 'جميع المتاحف'
};

const categoryBadges = {
    'image': { icon: 'fa-image', text: 'صورة' },
    'artifact_card': { icon: 'fa-id-card', text: 'بطاقة أثرية' },
    'file': { icon: 'fa-file-pdf', text: 'ملف PDF' }
};

let allGalleryItems = [];
let filteredItems = [];

// Initialize Gallery
document.addEventListener('DOMContentLoaded', async () => {
    await fetchGalleryData();
    setupFilters();
    setupSearch();
    setupFavoritesSystem();
});

async function fetchGalleryData() {
    const grid = document.getElementById('gallery-grid');
    const loading = document.getElementById('gallery-loading');
    
    try {
        if (typeof AppwriteConfig !== 'undefined' && typeof Appwrite !== 'undefined') {
            const { Client, Databases, Query } = Appwrite;
            const client = new Client()
                .setEndpoint(AppwriteConfig.endpoint)
                .setProject(AppwriteConfig.projectId);
            
            const databases = new Databases(client);
            
            try {
                const response = await databases.listDocuments(
                    AppwriteConfig.databaseId, 
                    'museum_gallery',
                    [Query.limit(100)]
                );
                
                if (response.documents.length > 0) {
                    allGalleryItems = response.documents.map(doc => {
                        const coverImg = doc.coverImage;
                        const file = doc.fileUrl;
                        
                        // Map cover image using gallery bucket
                        if (coverImg && coverImg.startsWith('http')) {
                            doc.actualImageUrl = coverImg;
                        } else if (coverImg) {
                            doc.actualImageUrl = getAppwriteImageUrl(coverImg, '6a237511000001e303ff');
                        } else if (file && (file.startsWith('http') || file.startsWith('assets/'))) {
                            doc.actualImageUrl = file;
                        } else if (file) {
                            doc.actualImageUrl = getAppwriteImageUrl(file, '6a237511000001e303ff');
                        } else {
                            doc.actualImageUrl = 'assets/placeholder.png';
                        }
                        
                        // Map fileUrl to full download/view link if stored as a file ID
                        if (file && !file.startsWith('http') && !file.startsWith('assets/')) {
                            doc.fileUrl = `${AppwriteConfig.endpoint}/storage/buckets/6a237511000001e303ff/files/${file}/view?project=${AppwriteConfig.projectId}`;
                        }
                        
                        return doc;
                    });
                    
                    // Preload all gallery images in background
                    setTimeout(() => {
                        allGalleryItems.forEach(item => {
                            if (item.actualImageUrl) {
                                const img = new Image();
                                img.src = item.actualImageUrl;
                            }
                        });
                    }, 100);
                } else {
                    allGalleryItems = [];
                }
            } catch (e) {
                console.warn("Appwrite collection 'museum_gallery' not found.", e);
            }
        }
    } catch (error) {
        console.error('Error fetching gallery:', error);
    }

    filteredItems = [...allGalleryItems];
    if(loading) loading.style.display = 'none';
    renderGrid();
}

function renderGrid() {
    const grid = document.getElementById('gallery-grid');
    const emptyState = document.getElementById('gallery-empty');
    
    // Clear existing
    grid.innerHTML = '';
    
    if (filteredItems.length === 0) {
        emptyState.classList.remove('d-none');
        return;
    }
    
    emptyState.classList.add('d-none');
    
    const lang = sessionStorage.getItem('lang') || 'ar';
    
    filteredItems.forEach((item, index) => {
        const badgeInfo = categoryBadges[item.category] || categoryBadges['image'];
        const museumName = museumNames[item.museum] || item.museum;
        const isFav = isFavorite(item.$id);
        
        let title = item.titleAr || item.title || 'مجهول';
        if(lang === 'en' && item.titleEn) title = item.titleEn;
        if(lang === 'fr' && item.titleFr) title = item.titleFr;
        
        let desc = item.shortDescriptionAr || item.description || '';
        if(lang === 'en' && item.shortDescriptionEn) desc = item.shortDescriptionEn;
        if(lang === 'fr' && item.shortDescriptionFr) desc = item.shortDescriptionFr;
        
        let actionsHtml = '';
        if (item.category === 'file') {
            const fileLink = item.fileUrl || item.actualImageUrl;
            actionsHtml = `
                <a href="${fileLink}" target="_blank" class="item-btn btn-primary" title="معاينة الملف">
                    معاينة الملف <i class="fas fa-external-link-alt ms-1"></i>
                </a>
            `;
        } else if (item.category === 'artifact_card') {
            actionsHtml = `
                <a href="item.html?id=${item.$id}" class="item-btn btn-primary" title="عرض التفاصيل">
                    التفاصيل <i class="fas fa-info-circle ms-1"></i>
                </a>
                <button onclick="downloadItem('${item.actualImageUrl}', '${title}')" class="item-btn" title="تحميل">
                    <i class="fas fa-download"></i>
                </button>
            `;
        } else if (item.category === 'image' || !item.category) {
            actionsHtml = `
                <button onclick="previewImage('${item.actualImageUrl}', '${title.replace(/'/g, "\\'")}')" class="item-btn btn-primary" title="معاينة">
                    معاينة <i class="fas fa-eye ms-1"></i>
                </button>
                <button onclick="downloadItem('${item.actualImageUrl}', '${title.replace(/'/g, "\\'")}')" class="item-btn" title="تحميل">
                    <i class="fas fa-download"></i>
                </button>
            `;
        }
        
        const cardHtml = `
            <div class="store-card" data-aos="fade-up" data-aos-delay="${(index % 4) * 100}">
                <img src="${item.actualImageUrl}" alt="${title}" loading="eager" fetchpriority="high" onerror="this.style.display='none'; this.closest('.store-card').classList.add('no-image');">
                <div class="store-card-content">
                    <span class="item-badge"><i class="fas ${badgeInfo.icon} me-1"></i> ${badgeInfo.text}</span>
                    <h3 class="item-title">${title}</h3>
                    <p class="item-museum"><i class="fas fa-landmark me-1"></i> ${museumName}</p>
                    ${desc ? `<p style="font-size:0.85rem; color:rgba(255,255,255,0.7); margin-bottom:15px; flex-grow:1;">${desc}</p>` : ''}
                    
                    <div class="item-actions">
                        ${actionsHtml}
                        <button onclick="shareItem('${item.$id}', '${title}')" class="item-btn" title="مشاركة">
                            <i class="fas fa-share-nodes"></i>
                        </button>
                        <button onclick="toggleFavorite('${item.$id}', this)" class="item-btn favorite-btn ${isFav ? 'active' : ''}" title="إضافة للمفضلة">
                            <i class="fas fa-heart"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        grid.insertAdjacentHTML('beforeend', cardHtml);
    });
}

// Filters logic
let currentMuseumFilter = 'all';
let currentTypeFilter = 'all';
let currentSearchQuery = '';

function setupFilters() {
    const museumBtns = document.querySelectorAll('.filters-container .filter-btn');
    
    museumBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            museumBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentMuseumFilter = e.target.getAttribute('data-filter');
            applyFilters();
        });
    });
}

function setupSearch() {
    const searchInput = document.getElementById('gallery-search');
    if(searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearchQuery = e.target.value.toLowerCase();
            applyFilters();
        });
    }
}

function normalizeArabic(text) {
    if (!text) return '';
    return text.replace(/[أإآا]/g, 'ا')
               .replace(/ة/g, 'ه')
               .replace(/[ًٌٍَُِّْ]/g, '');
}

function applyFilters() {
    const dbMuseumMap = { 'tourism': 'tourism_museum', 'science': 'science_museum', 'art': 'modern_art_museum' };
    
    filteredItems = allGalleryItems.filter(item => {
        // Museum filter
        if (currentMuseumFilter !== 'all') {
            const dbVal = dbMuseumMap[currentMuseumFilter];
            if (item.museum !== dbVal) return false;
        }
        
        // Search
        if (currentSearchQuery) {
            const searchStr = normalizeArabic(`${item.titleAr || ''} ${item.titleEn || ''} ${museumNames[item.museum] || ''} ${item.shortDescriptionAr || ''}`.toLowerCase());
            if (!searchStr.includes(normalizeArabic(currentSearchQuery))) return false;
        }
        
        return true;
    });
    
    renderGrid();
}

// Actions Logic
async function downloadItem(url, title) {
    try {
        let downloadUrl = url;
        // Convert view/preview to download
        downloadUrl = downloadUrl.replace('/view?', '/download?').replace('/preview?', '/download?');
        
        // Strip preview-only query parameters that Appwrite download endpoint rejects
        downloadUrl = downloadUrl.split('&quality')[0]
                                 .split('&width')[0]
                                 .split('&height')[0];
        
        // Fetch as blob to force direct download in same page (cross-origin)
        const response = await fetch(downloadUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = title || 'download';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
        console.error('Direct download failed, falling back to basic link download', e);
        
        let downloadUrl = url;
        downloadUrl = downloadUrl.replace('/view?', '/download?').replace('/preview?', '/download?');
        downloadUrl = downloadUrl.split('&quality')[0]
                                 .split('&width')[0]
                                 .split('&height')[0];
                                 
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = title || 'download';
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
}

function previewImage(url, title) {
    const modalHtml = `
        <div id="image-preview-modal" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(10, 25, 47, 0.95); backdrop-filter: blur(10px); z-index: 9999; display: flex; align-items: center; justify-content: center; flex-direction: column; opacity: 0; transition: opacity 0.3s ease;">
            <button onclick="closePreviewModal()" style="position: absolute; top: 20px; right: 25px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; width: 45px; height: 45px; border-radius: 50%; font-size: 1.5rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;"><i class="fas fa-times"></i></button>
            <img src="${url}" alt="${title}" style="max-width: 90%; max-height: 80vh; object-fit: contain; border-radius: 10px; box-shadow: 0 10px 40px rgba(0,0,0,0.6); transform: scale(0.9); transition: transform 0.3s ease;" id="preview-modal-img">
            <h3 style="color: white; margin-top: 25px; font-family: 'Cairo', sans-serif; font-weight: 700; text-align: center; padding: 0 15px;">${title}</h3>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Animate in
    setTimeout(() => {
        const modal = document.getElementById('image-preview-modal');
        const img = document.getElementById('preview-modal-img');
        if (modal && img) {
            modal.style.opacity = '1';
            img.style.transform = 'scale(1)';
        }
    }, 10);
}

window.closePreviewModal = function() {
    const modal = document.getElementById('image-preview-modal');
    if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => modal.remove(), 300);
    }
};

function shareItem(id, title) {
    const url = window.location.origin + window.location.pathname.replace('gallery.html', '') + 'item.html?id=' + id;
    if (navigator.share) {
        navigator.share({
            title: title,
            text: 'اكتشف هذا المحتوى الرائع على موقع متاحف جامعة المنيا.',
            url: url,
        }).catch((error) => console.log('Error sharing', error));
    } else {
        // Fallback
        navigator.clipboard.writeText(url).then(() => {
            alert('تم نسخ رابط المشاركة!');
        });
    }
}

// Favorites Logic
function initFavorites() {
    if (!sessionStorage.getItem('mat7afi_favorites')) {
        sessionStorage.setItem('mat7afi_favorites', JSON.stringify([]));
    }
}

function getFavorites() {
    try {
        return JSON.parse(sessionStorage.getItem('mat7afi_favorites')) || [];
    } catch {
        return [];
    }
}

function isFavorite(id) {
    const favs = getFavorites();
    return favs.includes(id);
}

function toggleFavorite(id, btnElement) {
    let favs = getFavorites();
    if (favs.includes(id)) {
        favs = favs.filter(favId => favId !== id);
        btnElement.classList.remove('active');
    } else {
        favs.push(id);
        btnElement.classList.add('active');
        
        // Animate heart
        const icon = btnElement.querySelector('i');
        icon.style.transform = 'scale(1.3)';
        setTimeout(() => icon.style.transform = 'scale(1)', 200);
    }
    sessionStorage.setItem('mat7afi_favorites', JSON.stringify(favs));
}
