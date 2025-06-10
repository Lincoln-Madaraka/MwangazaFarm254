// Initialize Firebase
const firebaseConfig = {
    apiKey: "####",
    authDomain: "#####",
    projectId: "#####",
    storageBucket: "####",
    messagingSenderId: "###",
    appId: "####"
};

// Initialize Firebase with error handling
let db;
let auth;
let currentUser = null;

try {
    // Check if Firebase is already initialized
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }

    // Initialize services
    db = firebase.firestore();
    auth = firebase.auth();

    // Enable persistence for offline support
    db.enablePersistence()
        .catch((err) => {
            if (err.code === 'failed-precondition') {
                console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
            } else if (err.code === 'unimplemented') {
                console.warn('The current browser does not support persistence.');
            }
        });

    console.log('Firebase initialized successfully');
} catch (error) {
    console.error('Firebase initialization error:', error);
    showNotification('Failed to initialize the application. Please refresh the page.', 'error');
}

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing application...');

    // Initialize UI elements
    initializeUI();
    setupEventListeners();

    // Auth state observer
    auth.onAuthStateChanged((user) => {
        console.log('Auth state changed:', user ? 'User logged in' : 'No user');
        currentUser = user;
        updateAuthUI();

        // Load listings if user is logged in
        if (user) {
            loadListings();
        }
    }, (error) => {
        console.error('Auth state change error:', error);
        showNotification('Authentication error. Please try again.', 'error');
    });
});

function initializeUI() {
    // Mobile menu toggle
    const hamburger = document.querySelector(".hamburger");
    const navMenu = document.querySelector(".nav-links");

    if (hamburger && navMenu) {
        hamburger.addEventListener("click", () => {
            hamburger.classList.toggle("active");
            navMenu.classList.toggle("active");
        });
    }

    document.querySelectorAll(".nav-links li").forEach(n =>
        n.addEventListener("click", () => {
            if (hamburger && navMenu) {
                hamburger.classList.remove("active");
                navMenu.classList.remove("active");
            }
        }));

    // Initialize modals
    initializeModals();
}

function initializeModals() {
    const modals = document.querySelectorAll('.modal');
    const closeButtons = document.querySelectorAll('.close');

    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            button.closest('.modal').classList.remove('show');
        });
    });

    window.addEventListener('click', (e) => {
        modals.forEach(modal => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
    });
}

function setupEventListeners() {
    // Auth buttons
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');

    if (loginBtn) {
        loginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('loginModal').classList.add('show');
        });
    }

    if (signupBtn) {
        signupBtn.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('signupModal').classList.add('show');
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }

    // Marketplace filters
    const searchButton = document.getElementById('searchButton');
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    const locationFilter = document.getElementById('locationFilter');
    const priceFilter = document.getElementById('priceFilter');

    if (searchButton) {
        searchButton.addEventListener('click', () => {
            filterListings();
        });
    }

    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                filterListings();
            }
        });
    }

    if (categoryFilter) {
        categoryFilter.addEventListener('change', filterListings);
    }

    if (locationFilter) {
        locationFilter.addEventListener('change', filterListings);
    }

    if (priceFilter) {
        priceFilter.addEventListener('change', filterListings);
    }

    // Form submission
    const produceForm = document.getElementById('produceForm');
    const listingResult = document.getElementById('listing-result');
    const editListingBtn = document.getElementById('edit-listing');
    const saveListingBtn = document.getElementById('save-listing');

    console.log('Form elements found:', {
        produceForm: !!produceForm,
        listingResult: !!listingResult,
        editListingBtn: !!editListingBtn,
        saveListingBtn: !!saveListingBtn
    });

    if (produceForm) {
        produceForm.addEventListener('submit', handleProduceForm);
    }

    if (editListingBtn) {
        editListingBtn.addEventListener('click', () => {
            console.log('Edit button clicked');
            listingResult.classList.add('hidden');
            window.scrollTo({
                top: document.getElementById('listing-form').offsetTop - 100,
                behavior: 'smooth'
            });
        });
    }

    if (saveListingBtn) {
        saveListingBtn.addEventListener('click', () => {
            console.log('Save button clicked');
            saveListing();
        });
    }
}

async function handleLogin(e) {
    e.preventDefault();
    console.log('Login attempt');

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        console.log('Login successful:', userCredential.user);
        document.getElementById('loginModal').classList.remove('show');
        showNotification('Logged in successfully', 'success');
    } catch (error) {
        console.error('Login error:', error);
        showNotification(error.message, 'error');
    }
}

async function handleSignup(e) {
    e.preventDefault();
    console.log('Signup attempt');

    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const userType = document.getElementById('userType').value;

    // Validate inputs
    if (!name || !email || !password || !userType) {
        showNotification('Please fill in all fields', 'error');
        return;
    }

    if (password.length < 6) {
        showNotification('Password must be at least 6 characters long', 'error');
        return;
    }

    try {
        // Create user with email and password
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        console.log('Signup successful:', userCredential.user);

        // Update user profile with display name
        await userCredential.user.updateProfile({
            displayName: name
        });

        // Save additional user data to Firestore
        const userData = {
            name,
            email,
            userType,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            uid: userCredential.user.uid
        };

        await db.collection('users').doc(userCredential.user.uid).set(userData);
        console.log('User data saved to Firestore');

        // Clear the form
        document.getElementById('signupForm').reset();

        // Close the modal
        document.getElementById('signupModal').classList.remove('show');

        // Show success message
        showNotification('Account created successfully! Welcome to MwangazaFarm.', 'success');

        // Update UI
        updateAuthUI();

    } catch (error) {
        console.error('Signup error:', error);
        let errorMessage = 'An error occurred during signup.';

        // Handle specific Firebase auth errors
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = 'This email is already registered. Please login instead.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Please enter a valid email address.';
                break;
            case 'auth/operation-not-allowed':
                errorMessage = 'Email/password accounts are not enabled. Please contact support.';
                break;
            case 'auth/weak-password':
                errorMessage = 'Please choose a stronger password.';
                break;
            default:
                errorMessage = error.message;
        }

        showNotification(errorMessage, 'error');
    }
}

function updateAuthUI() {
    const authLinks = document.querySelector('.auth-links');
    if (!authLinks) {
        console.error('Auth links container not found');
        return;
    }

    if (currentUser) {
        console.log('Updating UI for logged in user:', currentUser.displayName);
        const userName = currentUser.displayName || currentUser.email || 'User';

        // Get user type from Firestore
        db.collection('users').doc(currentUser.uid).get()
            .then((doc) => {
                if (doc.exists) {
                    const userData = doc.data();
                    const userType = userData.userType;

                    // Update UI based on user type
                    if (userType === 'buyer') {
                        // Show marketplace section for buyers
                        document.getElementById('marketplace').classList.remove('hidden');
                        document.getElementById('listing-form').classList.add('hidden');
                    } else {
                        // Show listing form for farmers
                        document.getElementById('marketplace').classList.add('hidden');
                        document.getElementById('listing-form').classList.remove('hidden');
                    }

                    authLinks.innerHTML = `
                        <span class="welcome-text">Welcome, ${userName} (${userType})</span>
                        <button class="btn btn-secondary" id="logoutBtn">Logout</button>
                    `;
                }
            })
            .catch((error) => {
                console.error('Error getting user data:', error);
            });

        // Add event listener to logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
        }
    } else {
        console.log('Updating UI for logged out state');
        authLinks.innerHTML = `
            <a href="#" id="loginBtn" class="btn btn-secondary">Login</a>
            <a href="#" id="signupBtn" class="btn">Sign Up</a>
        `;

        // Reattach event listeners
        const loginBtn = document.getElementById('loginBtn');
        const signupBtn = document.getElementById('signupBtn');

        if (loginBtn) {
            loginBtn.addEventListener('click', (e) => {
                e.preventDefault();
                document.getElementById('loginModal').classList.add('show');
            });
        }

        if (signupBtn) {
            signupBtn.addEventListener('click', (e) => {
                e.preventDefault();
                document.getElementById('signupModal').classList.add('show');
            });
        }
    }
}

async function handleLogout() {
    try {
        await auth.signOut();
        console.log('Logout successful');
        showNotification('Logged out successfully', 'success');
    } catch (error) {
        console.error('Logout error:', error);
        showNotification(error.message, 'error');
    }
}

async function handleProduceForm(e) {
    e.preventDefault();
    console.log('Form submitted');

    if (!currentUser) {
        showNotification('Please login to create a listing', 'error');
        return;
    }

    try {
        const produce = document.getElementById('produce').value.trim();
        const category = document.getElementById('category').value;
        const quantity = document.getElementById('quantity').value.trim();
        const price = document.getElementById('price').value.trim();
        const location = document.getElementById('location').value.trim();

        console.log('Form values:', { produce, category, quantity, price, location });

        if (!produce || !category || !quantity || !price || !location) {
            showNotification('Please fill in all fields', 'error');
            return;
        }

        generateListing(produce, category, quantity, price, location);
    } catch (error) {
        console.error('Error handling form submission:', error);
        showNotification('Error processing form. Please try again.', 'error');
    }
}

async function loadListings() {
    if (!currentUser) return;

    db.collection('users').doc(currentUser.uid).get()
        .then((doc) => {
            if (doc.exists && doc.data().userType === 'buyer') {
                db.collection('produceListings')
                    .orderBy('timestamp', 'desc')
                    .get()
                    .then((snapshot) => {
                        const listingsGrid = document.getElementById('listingsGrid');
                        if (!listingsGrid) return;

                        listingsGrid.innerHTML = '';
                        snapshot.forEach(doc => {
                            const listing = doc.data();
                            const listingElement = createListingElement(doc.id, listing);
                            listingsGrid.appendChild(listingElement);
                        });
                    })
                    .catch((error) => {
                        console.error('Error loading listings:', error);
                        showNotification('Error loading listings', 'error');
                    });
            }
        })
        .catch((error) => {
            console.error('Error checking user type:', error);
        });
}

function createListingElement(id, listing) {
    const div = document.createElement('div');
    div.className = 'listing-card';
    div.dataset.category = listing.category; // Add category to dataset

    // Extract price number from the price string (e.g., "KES 100/kg" -> 100)
    const priceMatch = listing.price.match(/\d+/);
    const price = priceMatch ? priceMatch[0] : '0';

    div.innerHTML = `
        <div class="listing-image">
            <i class="fas fa-seedling"></i>
        </div>
        <div class="listing-content">
            <h3 class="listing-title">${listing.title}</h3>
            <div class="listing-price">KES ${price}/kg</div>
            <div class="listing-details">
                <div class="listing-detail">
                    <i class="fas fa-weight-hanging"></i>
                    <span>${listing.quantity}</span>
                </div>
                <div class="listing-detail">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${listing.location}</span>
                </div>
            </div>
            <p>${listing.description}</p>
            <div class="listing-actions">
                <button class="btn btn-secondary message-btn" data-listing-id="${id}">
                    <i class="fas fa-envelope"></i> Message
                </button>
            </div>
        </div>
    `;

    div.querySelector('.message-btn').addEventListener('click', () => {
        if (!currentUser) {
            showNotification('Please login to send messages', 'error');
            return;
        }
        openMessageModal(id, listing);
    });

    return div;
}

function filterListings() {
    console.log('Filtering listings...');
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const category = document.getElementById('categoryFilter').value;
    const location = document.getElementById('locationFilter').value;
    const priceRange = document.getElementById('priceFilter').value;

    console.log('Filter criteria:', { searchTerm, category, location, priceRange });

    const listings = document.querySelectorAll('.listing-card');
    listings.forEach(listing => {
        const title = listing.querySelector('.listing-title').textContent.toLowerCase();
        const listingCategory = listing.dataset.category;
        const listingLocation = listing.querySelector('.listing-detail:last-child span').textContent.toLowerCase();
        const priceText = listing.querySelector('.listing-price').textContent;
        const price = parseInt(priceText.match(/\d+/)[0]);

        console.log('Listing details:', { title, listingCategory, listingLocation, price });

        const matchesSearch = title.includes(searchTerm);
        const matchesCategory = !category || listingCategory === category;
        const matchesLocation = !location || listingLocation.includes(location.toLowerCase());
        const matchesPrice = !priceRange || checkPriceRange(price, priceRange);

        const shouldShow = matchesSearch && matchesCategory && matchesLocation && matchesPrice;
        console.log('Should show listing:', shouldShow);

        listing.style.display = shouldShow ? 'block' : 'none';
    });
}

function checkPriceRange(price, range) {
    switch (range) {
        case '0-50':
            return price >= 0 && price <= 50;
        case '51-100':
            return price > 50 && price <= 100;
        case '101-200':
            return price > 100 && price <= 200;
        case '201+':
            return price > 200;
        default:
            return true;
    }
}

function openMessageModal(listingId, listing) {
    const modal = document.getElementById('messageModal');
    const messagesList = modal.querySelector('.messages-list');
    const sendButton = document.getElementById('sendMessage');

    // Load messages
    loadMessages(listingId, messagesList);

    // Setup send message handler
    sendButton.onclick = () => {
        const messageText = document.getElementById('messageText').value.trim();
        if (messageText) {
            sendMessage(listingId, messageText);
            document.getElementById('messageText').value = '';
        }
    };

    modal.classList.add('show');
}

async function loadMessages(listingId, messagesList) {
    try {
        const snapshot = await db.collection('messages')
            .where('listingId', '==', listingId)
            .orderBy('timestamp', 'asc')
            .get();

        messagesList.innerHTML = '';
        snapshot.forEach(doc => {
            const message = doc.data();
            const messageElement = createMessageElement(message);
            messagesList.appendChild(messageElement);
        });
        messagesList.scrollTop = messagesList.scrollHeight;
    } catch (error) {
        console.error('Error loading messages:', error);
        showNotification('Error loading messages', 'error');
    }
}

function createMessageElement(message) {
    const div = document.createElement('div');
    div.className = `message ${message.senderId === currentUser.uid ? 'sent' : 'received'}`;
    div.textContent = message.text;
    return div;
}

async function sendMessage(listingId, text) {
    try {
        await db.collection('messages').add({
            listingId,
            senderId: currentUser.uid,
            senderName: currentUser.displayName || 'Anonymous',
            text,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Error sending message:', error);
        showNotification('Error sending message', 'error');
    }
}

// Generate listing
function generateListing(produce, category, quantity, price, location) {
    console.log('Starting listing generation with:', { produce, category, quantity, price, location });

    try {
        // Validate inputs
        if (!produce || !category || !quantity || !price || !location) {
            throw new Error('Missing required fields');
        }

        // Get DOM elements
        const titleElement = document.getElementById('listing-title');
        const quantityElement = document.getElementById('listing-quantity');
        const locationElement = document.getElementById('listing-location');
        const priceElement = document.getElementById('listing-price');
        const descriptionElement = document.getElementById('listing-description');
        const listingResult = document.getElementById('listing-result');

        // Validate DOM elements
        if (!titleElement || !quantityElement || !locationElement || !priceElement || !descriptionElement || !listingResult) {
            throw new Error('Required DOM elements not found');
        }

        // Update listing details
        titleElement.textContent = capitalizeFirstLetter(produce);
        quantityElement.textContent = `${quantity} kg`;
        locationElement.textContent = capitalizeFirstLetter(location);
        priceElement.textContent = `KES ${price}/kg`;

        console.log('Updated basic listing details');

        // Generate description based on category and produce
        const descriptions = {
            'vegetables': {
                'tomatoes': `Fresh, sun-ripened ${produce} grown using sustainable farming methods in the fertile soils of ${location}. Our ${produce} are hand-picked at peak ripeness to ensure maximum flavor and nutritional value. Perfect for salads, sauces, or cooking.`,
                'kale': `Organic ${produce} freshly harvested from ${location}. Rich in vitamins and minerals, our ${produce} is grown without pesticides and harvested at the perfect stage for maximum nutritional benefits.`,
                'default': `Fresh ${produce} grown by local farmers in ${location}. Our vegetables are harvested at optimal ripeness to ensure the best quality and taste. We use sustainable farming practices to bring you nutritious and delicious food while protecting the environment.`
            },
            'fruits': {
                'mangoes': `Sweet and juicy ${produce} from the orchards of ${location}. Our ${produce} are tree-ripened for maximum sweetness and flavor. Perfect for eating fresh or in desserts.`,
                'bananas': `Premium quality ${produce} from ${location}. Our ${produce} are grown using organic methods and harvested at the perfect stage of ripeness. Great for snacking or cooking.`,
                'default': `Fresh ${produce} harvested from our orchards in ${location}. Our fruits are picked at peak ripeness to ensure the best flavor and nutritional value. We use sustainable farming practices to bring you the finest quality produce.`
            },
            'grains': {
                'maize': `Premium quality ${produce} cultivated in the rich agricultural lands of ${location}. Our ${produce} is grown using traditional methods combined with modern sustainable practices to ensure top quality and taste. Ideal for both human consumption and animal feed.`,
                'wheat': `High-quality ${produce} from the fertile fields of ${location}. Our ${produce} is carefully harvested and processed to maintain its nutritional value. Perfect for baking and cooking.`,
                'default': `Quality ${produce} grown in the agricultural regions of ${location}. Our grains are cultivated using sustainable farming methods to ensure the best quality and nutritional value.`
            },
            'legumes': {
                'beans': `Nutritious ${produce} harvested from our family farm in ${location}. High in protein and fiber, these ${produce} are carefully sorted and cleaned. Great for traditional dishes or modern recipes.`,
                'lentils': `Premium ${produce} from the farms of ${location}. Our ${produce} are carefully harvested and processed to maintain their nutritional value. Perfect for soups, stews, and salads.`,
                'default': `Fresh ${produce} grown in the fertile soils of ${location}. Our legumes are harvested at peak ripeness and carefully processed to ensure the best quality and nutritional value.`
            }
        };

        // Get the appropriate description
        let description;
        if (descriptions[category]) {
            description = descriptions[category][produce.toLowerCase()] ||
                          descriptions[category]['default'] ||
                          `Fresh ${produce} from ${location}. Our produce is grown using sustainable farming methods to ensure the best quality and taste.`;
        } else {
            description = `Fresh ${produce} from ${location}. Our produce is grown using sustainable farming methods to ensure the best quality and taste.`;
        }

        console.log('Generated description:', description);

        // Update the description
        descriptionElement.textContent = description;

        // Show the listing result
        listingResult.classList.remove('hidden');
        console.log('Listing generated successfully');

        // Scroll to the listing result
        window.scrollTo({
            top: listingResult.offsetTop - 100,
            behavior: 'smooth'
        });

    } catch (error) {
        console.error('Error generating listing:', error);
        showNotification(error.message || 'Error generating listing. Please try again.', 'error');
    }
}

// Save listing to Firestore
async function saveListing() {
    console.log('Attempting to save listing');

    if (!currentUser) {
        showNotification('Please login to save a listing', 'error');
        return;
    }

    if (!db) {
        console.error('Firestore not initialized');
        showNotification('Database connection error. Please try again.', 'error');
        return;
    }

    try {
        const listingData = {
            title: document.getElementById('listing-title').textContent,
            description: document.getElementById('listing-description').textContent,
            quantity: document.getElementById('listing-quantity').textContent,
            price: document.getElementById('listing-price').textContent,
            location: document.getElementById('listing-location').textContent,
            category: document.getElementById('category').value,
            sellerId: currentUser.uid,
            sellerName: currentUser.displayName || 'Anonymous',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };

        console.log('Saving listing data:', listingData);

        const docRef = await db.collection('produceListings').add(listingData);

        showNotification('Thank you! Your listing has been added successfully.', 'success');
        console.log('Listing saved to Firestore with ID:', docRef.id);

        // Reset form and hide listing result
        document.getElementById('produceForm').reset();
        document.getElementById('listing-result').classList.add('hidden');

    } catch (error) {
        console.error('Error saving listing:', error);
        showNotification('Failed to save listing. Please try again.', 'error');
    }
}

// Notification helper
function showNotification(message, type = 'info') {
    console.log('Showing notification:', { message, type });

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Capitalize helper
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// Notification styles dynamically added
const style = document.createElement('style');
style.textContent = `
.notification {
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 15px 20px;
  border-radius: 5px;
  color: white;
  font-weight: 500;
  max-width: 300px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  transform: translateY(100px);
  opacity: 0;
  transition: all 0.3s ease;
  z-index: 1000;
}

.notification.show {
  transform: translateY(0);
  opacity: 1;
}

.notification.success {
  background-color: #4caf50;
}

.notification.error {
  background-color: #f44336;
}

.notification.info {
  background-color: #2196f3;
}
`;
document.head.appendChild(style);

// Smooth scroll for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            window.scrollTo({
                top: target.offsetTop - 80,
                behavior: 'smooth'
            });
        }
    });
});

const toggleBtn = document.getElementById('themeToggleBtn');
const themeIcon = document.getElementById('themeIcon');
const themeLabel = document.getElementById('themeLabel');

function applyTheme(isDark) {
  if (isDark) {
    themeIcon.classList.replace('fa-moon', 'fa-sun');
    themeIcon.style.color = 'white';
    themeLabel.textContent = 'Light Mode';
    themeLabel.style.color = 'lightgray';
    toggleBtn.setAttribute('aria-label', 'Switch to Light Mode');
  } else {
    themeIcon.classList.replace('fa-sun', 'fa-moon');
    themeIcon.style.color = 'white';
    themeLabel.textContent = 'Dark Mode';
    themeLabel.style.color = 'lightgray';
    toggleBtn.setAttribute('aria-label', 'Switch to Dark Mode');
  }
}

applyTheme(document.body.classList.contains('dark-theme'));

toggleBtn.addEventListener('click', () => {
  const isDark = document.body.classList.toggle('dark-theme');
  applyTheme(isDark);
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
});



console.log('Application initialization complete');