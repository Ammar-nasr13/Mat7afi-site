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
            const { Client, Databases } = Appwrite;
            const client = new Client()
                .setEndpoint(AppwriteConfig.endpoint)
                .setProject(AppwriteConfig.projectId);
            
            const databases = new Databases(client);
            
            try {
                // Try fetching from Appwrite
                const response = await databases.listDocuments(
                    AppwriteConfig.databaseId, 
                    'museum_gallery' // Collection ID
                );
                
                if (response.documents.length > 0) {
                    allGalleryItems = response.documents.map(doc => {
                        doc.actualImageUrl = getAppwriteImageUrl(doc.coverImage || doc.fileUrl, AppwriteConfig.buckets.tourism);
                        return doc;
                    });
                } else {
                    allGalleryItems = [];
                }
            } catch (e) {
                console.warn("Appwrite collection 'museum_gallery' not found or empty.", e);
                allGalleryItems = [];
            }
        } else {
            console.warn("Appwrite SDK not found.");
            allGalleryItems = [];
        }
    } catch (error) {
        console.error('Error fetching gallery:', error);
        allGalleryItems = [];
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
    
    filteredItems.forEach((item, index) => {
        const badgeInfo = categoryBadges[item.category] || categoryBadges['image'];
        const museumName = museumNames[item.museum] || item.museum;
        const isFav = isFavorite(item.$id);
        
        const cardHtml = `
            <div class="store-card" data-aos="fade-up" data-aos-delay="${(index % 4) * 100}">
                <img src="${item.actualImageUrl}" alt="${item.titleAr}" loading="lazy">
                <div class="store-card-content">
                    <span class="item-badge"><i class="fas ${badgeInfo.icon} me-1"></i> ${badgeInfo.text}</span>
                    <h3 class="item-title">${item.titleAr}</h3>
                    <p class="item-museum"><i class="fas fa-landmark me-1"></i> ${museumName}</p>
                    
                    <div class="item-actions">
                        <a href="item.html?id=${item.$id}" class="item-btn btn-primary" title="معاينة">
                            معاينة
                        </a>
                        <button onclick="downloadItem('${item.actualImageUrl}', '${item.titleAr}')" class="item-btn" title="تحميل">
                            <i class="fas fa-download"></i>
                        </button>
                        <button onclick="shareItem('${item.$id}', '${item.titleAr}')" class="item-btn" title="مشاركة">
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
    const museumBtns = document.querySelectorAll('#museum-filters .filter-btn');
    const typeBtns = document.querySelectorAll('#type-filters .filter-btn');
    
    museumBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            museumBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentMuseumFilter = e.target.getAttribute('data-filter');
            applyFilters();
        });
    });
    
    typeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            typeBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentTypeFilter = e.target.getAttribute('data-filter');
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

function applyFilters() {
    filteredItems = allGalleryItems.filter(item => {
        // Museum filter
        if (currentMuseumFilter !== 'all' && item.museum !== currentMuseumFilter) return false;
        
        // Type filter
        if (currentTypeFilter !== 'all' && item.category !== currentTypeFilter) return false;
        
        // Search
        if (currentSearchQuery) {
            const searchStr = `${item.titleAr} ${item.titleEn || ''} ${museumNames[item.museum] || ''} ${item.shortDescription || ''}`.toLowerCase();
            if (!searchStr.includes(currentSearchQuery)) return false;
        }
        
        return true;
    });
    
    renderGrid();
}

// Actions Logic
function downloadItem(url, title) {
    const a = document.createElement('a');
    a.href = url;
    a.download = title || 'download';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

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
function setupFavoritesSystem() {
    if (!localStorage.getItem('mat7afi_favorites')) {
        localStorage.setItem('mat7afi_favorites', JSON.stringify([]));
    }
}

function getFavorites() {
    try {
        return JSON.parse(localStorage.getItem('mat7afi_favorites')) || [];
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
    localStorage.setItem('mat7afi_favorites', JSON.stringify(favs));
}
