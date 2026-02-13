// ==================== SUPABASE INITIALIZATION ====================
const SUPABASE_URL = 'https://bxhrnnwfqlsoviysqcdw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4aHJubndmcWxzb3ZpeXNxY2R3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3ODkzNDIsImV4cCI6MjA4MTM2NTM0Mn0.O7fpv0TrDd-8ZE3Z9B5zWyAuWROPis5GRnKMxmqncX8';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== GLOBAL STATE ====================
let currentUser = null;
let isAdmin = false;
let authMode = 'login';
let currentChatUserId = null;

// Admin credentials
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'Rantauprapat123';

// ==================== AUTH FUNCTIONS ====================
function showAuthModal() {
    document.getElementById('authModal').classList.add('active');
}

function closeAuthModal() {
    document.getElementById('authModal').classList.remove('active');
}

function toggleAuthMode() {
    authMode = authMode === 'login' ? 'register' : 'login';
    document.getElementById('authTitle').textContent = authMode === 'login' ? 'Login' : 'Register';
    document.getElementById('authSubmit').textContent = authMode === 'login' ? 'Login' : 'Register';
    document.getElementById('authToggle').textContent = authMode === 'login' ? 'Register instead' : 'Login instead';
}

async function handleAuth() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if (!username || !password) {
        alert('Please fill all fields');
        return;
    }

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        currentUser = {
            id: 'admin',
            username: 'admin',
            is_admin: true
        };
        isAdmin = true;
        updateUIForUser();
        closeAuthModal();
        showAdminPanel();
        return;
    }

    try {
        if (authMode === 'login') {
            const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
                email: `${username}@oracode.demo`,
                password: password
            });

            if (authError) throw authError;

            const { data: userData, error: userError } = await supabaseClient
                .from('users_oracode')
                .select('*')
                .eq('id', authData.user.id)
                .single();

            if (userError) throw userError;

            currentUser = userData;
        } else {
            const { data: authData, error: authError } = await supabaseClient.auth.signUp({
                email: `${username}@oracode.demo`,
                password: password,
                options: {
                    data: {
                        username: username
                    }
                }
            });

            if (authError) throw authError;

            const { data: userData, error: userError } = await supabaseClient
                .from('users_oracode')
                .insert([
                    {
                        id: authData.user.id,
                        username: username,
                        bio: '',
                        avatar_url: null
                    }
                ])
                .select()
                .single();

            if (userError) throw userError;

            currentUser = userData;
            alert('Registration successful! Please login.');
            toggleAuthMode();
            return;
        }

        updateUIForUser();
        closeAuthModal();
        showFeed();
    } catch (error) {
        console.error('Auth error:', error);
        alert('Authentication failed: ' + error.message);
    }
}

function guestMode() {
    currentUser = {
        id: 'guest',
        username: 'Guest',
        is_guest: true
    };
    updateUIForUser();
    closeAuthModal();
    showFeed();
}

function logout() {
    currentUser = null;
    isAdmin = false;
    updateUIForUser();
    showFeed();
}

function updateUIForUser() {
    const authBtn = document.getElementById('authBtn');
    if (currentUser) {
        if (currentUser.is_guest) {
            authBtn.innerHTML = '<i class="fas fa-user-secret"></i> Guest Mode';
        } else {
            authBtn.innerHTML = `<i class="fas fa-user"></i> ${currentUser.username}`;
        }
        authBtn.onclick = () => {
            if (confirm('Logout?')) logout();
        };
    } else {
        authBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
        authBtn.onclick = showAuthModal;
    }
}

// ==================== FEED FUNCTIONS ====================
async function showFeed() {
    const content = document.getElementById('mainContent');
    
    try {
        const { data: codes, error } = await supabaseClient
            .from('codes_oracode')
            .select(`
                *,
                users_oracode!inner(username, avatar_url)
            `)
            .eq('reviewed', true)
            .order('created_at', { ascending: false });

        if (error) throw error;

        let html = '<div class="grid-posts">';
        
        for (let code of codes || []) {
            const { count, error: starError } = await supabaseClient
                .from('stars_oracode')
                .select('*', { count: 'exact', head: true })
                .eq('code_id', code.id);

            if (starError) console.error('Error getting star count:', starError);

            let userStarred = false;
            if (currentUser && !currentUser.is_guest) {
                const { data: starData } = await supabaseClient
                    .from('stars_oracode')
                    .select('id')
                    .eq('user_id', currentUser.id)
                    .eq('code_id', code.id)
                    .maybeSingle();
                
                userStarred = !!starData;
            }

            html += `
                <div class="card">
                    <div class="card-header">
                        <div class="avatar" onclick="showUserProfile('${code.user_id}')" style="cursor: pointer;">
                            ${code.users_oracode?.avatar_url 
                                ? `<img src="${code.users_oracode.avatar_url}" alt="avatar">` 
                                : `<i class="fas fa-user"></i>`
                            }
                        </div>
                        <div class="user-info" onclick="showUserProfile('${code.user_id}')" style="cursor: pointer;">
                            <h3>${code.users_oracode?.username || 'Anonymous'}</h3>
                            <p>${new Date(code.created_at).toLocaleDateString()}</p>
                        </div>
                    </div>
                    <div class="card-title">${code.title}</div>
                    <div class="card-meta">
                        <span><i class="fas fa-code"></i> ${code.language || 'HTML/CSS/JS'}</span>
                        <span class="star-count">
                            <i class="fas ${userStarred ? 'fas' : 'far'} fa-star" style="color: ${userStarred ? '#ffd700' : 'inherit'};"></i> 
                            ${count || 0}
                        </span>
                    </div>
                    <div class="card-actions">
                        <button class="action-btn" onclick="runCode(${code.id})">
                            <i class="fas fa-play"></i> Run
                        </button>
                        ${currentUser && !currentUser.is_guest ? `
                            <button class="action-btn" onclick="starCode(${code.id})">
                                <i class="fas ${userStarred ? 'fas' : 'far'} fa-star"></i> 
                                ${userStarred ? 'Starred' : 'Star'}
                            </button>
                            <button class="action-btn" onclick="reportCode(${code.id})">
                                <i class="fas fa-flag"></i> Report
                            </button>
                            <button class="action-btn" onclick="openChat('${code.user_id}')">
                                <i class="fas fa-comment"></i> Chat
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        html += '</div>';
        content.innerHTML = html;
    } catch (error) {
        console.error('Error fetching codes:', error);
        content.innerHTML = '<p>Error loading feed. Please try again.</p>';
    }
}

// ==================== CODE FUNCTIONS ====================
function showUpload() {
    if (!currentUser || currentUser.is_guest) {
        alert('Please login to upload code');
        showAuthModal();
        return;
    }

    const content = document.getElementById('mainContent');
    content.innerHTML = `
        <div class="upload-section">
            <h2 style="margin-bottom: 20px;"><i class="fas fa-upload"></i> Upload Code</h2>
            <div class="upload-grid">
                <div class="form-group" style="grid-column: span 3;">
                    <label>Title *</label>
                    <input type="text" id="codeTitle" placeholder="Code title...">
                </div>
                <div class="form-group" style="grid-column: span 3;">
                    <label>Language</label>
                    <input type="text" id="codeLanguage" placeholder="e.g., JavaScript, Python, HTML/CSS">
                </div>
                <div class="form-group" style="grid-column: span 3;">
                    <label>HTML</label>
                    <textarea id="codeHTML" placeholder="<div>Your HTML here...</div>"></textarea>
                </div>
                <div class="form-group" style="grid-column: span 3;">
                    <label>CSS</label>
                    <textarea id="codeCSS" placeholder="/* Your CSS here */"></textarea>
                </div>
                <div class="form-group" style="grid-column: span 3;">
                    <label>JavaScript</label>
                    <textarea id="codeJS" placeholder="// Your JavaScript here"></textarea>
                </div>
            </div>
            <button class="btn" onclick="submitCode()">
                <i class="fas fa-paper-plane"></i> Submit for Review
            </button>
        </div>
    `;
}

async function submitCode() {
    const title = document.getElementById('codeTitle').value;
    const language = document.getElementById('codeLanguage').value;
    const html = document.getElementById('codeHTML').value;
    const css = document.getElementById('codeCSS').value;
    const js = document.getElementById('codeJS').value;

    if (!title) {
        alert('Title is required');
        return;
    }

    try {
        const { error } = await supabaseClient
            .from('codes_oracode')
            .insert([
                {
                    user_id: currentUser.id,
                    title,
                    language,
                    html_code: html,
                    css_code: css,
                    js_code: js,
                    reviewed: false,
                    created_at: new Date()
                }
            ]);

        if (error) throw error;

        alert('Terimakasih sudah membagikan kode anda! Kode akan muncul kalau sudah selesai ditinjau oleh Administrator. Silahkan menunggu sambil melihat-lihat kode lain!');
        
        await supabaseClient
            .from('notifications_oracode')
            .insert([
                {
                    user_id: '00000000-0000-0000-0000-000000000000',
                    type: 'new_code_review',
                    message: `New code "${title}" needs review`,
                    data: { code_title: title, user_id: currentUser.id },
                    read: false,
                    created_at: new Date()
                }
            ]);

        showFeed();
    } catch (error) {
        console.error('Error submitting code:', error);
        alert('Failed to submit code');
    }
}

async function runCode(codeId) {
    try {
        const { data: code, error } = await supabaseClient
            .from('codes_oracode')
            .select('*')
            .eq('id', codeId)
            .single();

        if (error || !code) {
            alert('Code not found');
            return;
        }

        await supabaseClient
            .from('codes_oracode')
            .update({ views: (code.views || 0) + 1 })
            .eq('id', codeId);

        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px; width: 95%; height: 80vh;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                    <h2>${code.title}</h2>
                    <button class="action-btn" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i> Close
                    </button>
                </div>
                <iframe style="width: 100%; height: calc(100% - 60px); border: 2px solid black;" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>
            </div>
        `;

        document.body.appendChild(modal);

        const iframe = modal.querySelector('iframe');
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <style>${code.css_code || ''}</style>
            </head>
            <body>
                ${code.html_code || ''}
                <script>${code.js_code || ''}<\/script>
            </body>
            </html>
        `);
        doc.close();
    } catch (error) {
        console.error('Error running code:', error);
        alert('Failed to run code');
    }
}

async function starCode(codeId) {
    if (!currentUser || currentUser.is_guest) {
        alert('Please login to star codes');
        return;
    }

    try {
        const { data: existing, error: checkError } = await supabaseClient
            .from('stars_oracode')
            .select('id')
            .eq('user_id', currentUser.id)
            .eq('code_id', codeId)
            .maybeSingle();

        if (checkError) throw checkError;

        if (existing) {
            const { error: deleteError } = await supabaseClient
                .from('stars_oracode')
                .delete()
                .eq('user_id', currentUser.id)
                .eq('code_id', codeId);

            if (deleteError) throw deleteError;
        } else {
            const { error: insertError } = await supabaseClient
                .from('stars_oracode')
                .insert([
                    {
                        user_id: currentUser.id,
                        code_id: codeId,
                        created_at: new Date()
                    }
                ]);

            if (insertError) throw insertError;
        }

        showFeed();
    } catch (error) {
        console.error('Error starring code:', error);
        alert('Failed to star code');
    }
}

async function reportCode(codeId) {
    if (!currentUser || currentUser.is_guest) {
        alert('Please login to report codes');
        return;
    }

    const reason = prompt('Why are you reporting this code?');
    if (!reason) return;

    try {
        const { error } = await supabaseClient
            .from('reports_oracode')
            .insert([
                {
                    user_id: currentUser.id,
                    code_id: codeId,
                    reason,
                    status: 'pending',
                    created_at: new Date()
                }
            ]);

        if (error) throw error;

        alert('Report submitted. Thank you for helping keep ORACODE safe!');
    } catch (error) {
        console.error('Error reporting code:', error);
        alert('Failed to submit report');
    }
}

// ==================== PROFILE FUNCTIONS ====================
function showProfile() {
    if (!currentUser || currentUser.is_guest) {
        alert('Please login to view profile');
        showAuthModal();
        return;
    }

    showUserProfile(currentUser.id);
}

async function showUserProfile(userId) {
    try {
        const { data: user, error: userError } = await supabaseClient
            .from('users_oracode')
            .select('*')
            .eq('id', userId)
            .single();

        if (userError) throw userError;

        const { data: codes, error: codesError } = await supabaseClient
            .from('codes_oracode')
            .select('*')
            .eq('user_id', userId)
            .eq('reviewed', true)
            .order('created_at', { ascending: false });

        if (codesError) throw codesError;

        const { count: followers, error: followersError } = await supabaseClient
            .from('follows_oracode')
            .select('*', { count: 'exact', head: true })
            .eq('following_id', userId);

        if (followersError) throw followersError;

        const { count: following, error: followingError } = await supabaseClient
            .from('follows_oracode')
            .select('*', { count: 'exact', head: true })
            .eq('follower_id', userId);

        if (followingError) throw followingError;

        let isFollowing = false;
        if (currentUser && !currentUser.is_guest && currentUser.id !== userId) {
            const { data: followData } = await supabaseClient
                .from('follows_oracode')
                .select('id')
                .eq('follower_id', currentUser.id)
                .eq('following_id', userId)
                .maybeSingle();
            
            isFollowing = !!followData;
        }

        const content = document.getElementById('mainContent');
        content.innerHTML = `
            <div class="profile-header">
                <div class="profile-avatar">
                    ${user.avatar_url 
                        ? `<img src="${user.avatar_url}" alt="avatar">`
                        : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--accent);"><i class="fas fa-user fa-3x"></i></div>`
                    }
                </div>
                <div class="profile-info">
                    <div class="profile-name">${user.username}</div>
                    <div class="profile-bio">${user.bio || 'No bio yet'}</div>
                    <div class="profile-stats">
                        <div class="stat">
                            <div class="stat-number">${codes?.length || 0}</div>
                            <div class="stat-label">Codes</div>
                        </div>
                        <div class="stat">
                            <div class="stat-number">${followers || 0}</div>
                            <div class="stat-label">Followers</div>
                        </div>
                        <div class="stat">
                            <div class="stat-number">${following || 0}</div>
                            <div class="stat-label">Following</div>
                        </div>
                    </div>
                    ${currentUser && currentUser.id !== userId && !currentUser.is_guest ? `
                        <button class="btn" style="margin-top: 15px;" onclick="followUser('${userId}')">
                            <i class="fas ${isFollowing ? 'fa-user-check' : 'fa-user-plus'}"></i> 
                            ${isFollowing ? 'Following' : 'Follow'}
                        </button>
                        <button class="btn btn-outline" style="margin-top: 15px;" onclick="openChat('${userId}')">
                            <i class="fas fa-comment"></i> Message
                        </button>
                    ` : ''}
                    ${currentUser && currentUser.id === userId ? `
                        <button class="btn" style="margin-top: 15px;" onclick="editProfile()">
                            <i class="fas fa-edit"></i> Edit Profile
                        </button>
                    ` : ''}
                </div>
            </div>
            <h3 style="margin-bottom: 20px;"><i class="fas fa-code"></i> ${user.username}'s Codes</h3>
            <div class="grid-posts" id="userCodes"></div>
        `;

        const codesContainer = document.getElementById('userCodes');
        if (codes && codes.length > 0) {
            codesContainer.innerHTML = codes.map(code => `
                <div class="card">
                    <div class="card-title">${code.title}</div>
                    <div class="card-meta">
                        <span><i class="fas fa-code"></i> ${code.language || 'HTML/CSS/JS'}</span>
                        <span>${new Date(code.created_at).toLocaleDateString()}</span>
                    </div>
                    <button class="action-btn" onclick="runCode(${code.id})">
                        <i class="fas fa-play"></i> Run
                    </button>
                </div>
            `).join('');
        } else {
            codesContainer.innerHTML = '<p>No codes yet</p>';
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        alert('Failed to load profile');
    }
}

async function followUser(userId) {
    if (!currentUser || currentUser.is_guest) {
        alert('Please login to follow users');
        return;
    }

    try {
        const { data: existing, error: checkError } = await supabaseClient
            .from('follows_oracode')
            .select('id')
            .eq('follower_id', currentUser.id)
            .eq('following_id', userId)
            .maybeSingle();

        if (checkError) throw checkError;

        if (existing) {
            const { error: deleteError } = await supabaseClient
                .from('follows_oracode')
                .delete()
                .eq('follower_id', currentUser.id)
                .eq('following_id', userId);

            if (deleteError) throw deleteError;
        } else {
            const { error: insertError } = await supabaseClient
                .from('follows_oracode')
                .insert([
                    {
                        follower_id: currentUser.id,
                        following_id: userId,
                        created_at: new Date()
                    }
                ]);

            if (insertError) throw insertError;
        }

        showUserProfile(userId);
    } catch (error) {
        console.error('Error following user:', error);
        alert('Failed to follow user');
    }
}

function editProfile() {
    const content = document.getElementById('mainContent');
    content.innerHTML = `
        <div class="upload-section">
            <h2 style="margin-bottom: 20px;"><i class="fas fa-edit"></i> Edit Profile</h2>
            <div class="form-group">
                <label>Bio</label>
                <textarea id="editBio" rows="4" style="width: 100%; border: 2px solid black; padding: 12px;">${currentUser.bio || ''}</textarea>
            </div>
            <div class="form-group">
                <label>Avatar URL</label>
                <input type="url" id="editAvatar" value="${currentUser.avatar_url || ''}" style="width: 100%; border: 2px solid black; padding: 12px;">
            </div>
            <button class="btn" onclick="saveProfile()">
                <i class="fas fa-save"></i> Save Changes
            </button>
        </div>
    `;
}

async function saveProfile() {
    const bio = document.getElementById('editBio').value;
    const avatar_url = document.getElementById('editAvatar').value;

    try {
        const { error } = await supabaseClient
            .from('users_oracode')
            .update({ bio, avatar_url })
            .eq('id', currentUser.id);

        if (error) throw error;

        currentUser.bio = bio;
        currentUser.avatar_url = avatar_url;
        
        showUserProfile(currentUser.id);
    } catch (error) {
        console.error('Error saving profile:', error);
        alert('Failed to save profile');
    }
}

// ==================== CHAT FUNCTIONS ====================
function openChat(userId) {
    if (!currentUser || currentUser.is_guest) {
        alert('Please login to chat');
        return;
    }

    currentChatUserId = userId;
    document.getElementById('chatModal').classList.add('active');
    loadChatMessages(userId);
}

function closeChatModal() {
    document.getElementById('chatModal').classList.remove('active');
    currentChatUserId = null;
}

async function loadChatMessages(otherUserId) {
    try {
        const { data: messages, error } = await supabaseClient
            .from('chats_oracode')
            .select('*')
            .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUser.id})`)
            .order('created_at', { ascending: true });

        if (error) throw error;

        const { data: otherUser } = await supabaseClient
            .from('users_oracode')
            .select('username')
            .eq('id', otherUserId)
            .single();

        document.getElementById('chatWith').innerHTML = `Chat with ${otherUser?.username || 'User'}`;

        const chatMessages = document.getElementById('chatMessages');
        chatMessages.innerHTML = messages.map(msg => `
            <div class="message ${msg.sender_id === currentUser.id ? 'own' : ''}">
                <div class="message-content">${msg.message}</div>
                <small>${new Date(msg.created_at).toLocaleTimeString()}</small>
            </div>
        `).join('');

        await supabaseClient
            .from('chats_oracode')
            .update({ read: true })
            .eq('sender_id', otherUserId)
            .eq('receiver_id', currentUser.id)
            .eq('read', false);

        chatMessages.scrollTop = chatMessages.scrollHeight;
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

async function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();

    if (!message || !currentChatUserId) return;

    try {
        const { error } = await supabaseClient
            .from('chats_oracode')
            .insert([
                {
                    sender_id: currentUser.id,
                    receiver_id: currentChatUserId,
                    message: message,
                    read: false,
                    created_at: new Date()
                }
            ]);

        if (error) throw error;

        input.value = '';
        loadChatMessages(currentChatUserId);
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

// ==================== ADMIN FUNCTIONS ====================
function showAdminPanel() {
    if (!isAdmin) return;

    const content = document.getElementById('mainContent');
    content.innerHTML = `
        <div class="admin-section active">
            <h2 style="margin-bottom: 20px;"><i class="fas fa-shield-alt"></i> Admin Panel</h2>
            
            <h3 style="margin: 30px 0 15px;"><i class="fas fa-clock"></i> Pending Reviews</h3>
            <div id="pendingReviews"></div>
            
            <h3 style="margin: 30px 0 15px;"><i class="fas fa-flag"></i> Reports</h3>
            <div id="reportsList"></div>
        </div>
    `;

    loadPendingReviews();
    loadReports();
}

async function loadPendingReviews() {
    try {
        const { data: codes, error } = await supabaseClient
            .from('codes_oracode')
            .select(`
                *,
                users_oracode!inner(username)
            `)
            .eq('reviewed', false)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const container = document.getElementById('pendingReviews');
        if (!codes || codes.length === 0) {
            container.innerHTML = '<p>No pending reviews</p>';
            return;
        }

        container.innerHTML = codes.map(code => `
            <div class="report-card">
                <h4>${code.title}</h4>
                <p>By: ${code.users_oracode?.username || 'Unknown'}</p>
                <p>Submitted: ${new Date(code.created_at).toLocaleString()}</p>
                <div style="display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap;">
                    <button class="action-btn" onclick="reviewCode(${code.id}, true)">
                        <i class="fas fa-check"></i> Approve
                    </button>
                    <button class="action-btn" onclick="reviewCode(${code.id}, false)">
                        <i class="fas fa-times"></i> Reject
                    </button>
                    <button class="action-btn" onclick="runCode(${code.id})">
                        <i class="fas fa-play"></i> Preview
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading pending reviews:', error);
    }
}

async function loadReports() {
    try {
        const { data: reports, error } = await supabaseClient
            .from('reports_oracode')
            .select(`
                *,
                users_oracode!reports_oracode_user_id_fkey (username),
                codes_oracode!reports_oracode_code_id_fkey (title, user_id)
            `)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading reports:', error);
            throw error;
        }

        const container = document.getElementById('reportsList');
        if (!reports || reports.length === 0) {
            container.innerHTML = '<p>No pending reports</p>';
            return;
        }

        container.innerHTML = reports.map(report => {
            console.log('Report data:', report);
            
            return `
            <div class="report-card">
                <h4>Report #${report.id}</h4>
                <p><i class="fas fa-user"></i> Reported by: ${report.users_oracode?.username || 'Unknown'}</p>
                <p><i class="fas fa-code"></i> Code: ${report.codes_oracode?.title || 'Unknown'}</p>
                <p><i class="fas fa-exclamation-triangle"></i> Reason: ${report.reason}</p>
                <p><i class="fas fa-clock"></i> Date: ${new Date(report.created_at).toLocaleString()}</p>
                <div style="display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap;">
                    <button class="action-btn" onclick="handleReport(${report.id}, 'approved', ${report.code_id})">
                        <i class="fas fa-check"></i> Approve Report
                    </button>
                    <button class="action-btn" onclick="handleReport(${report.id}, 'rejected')">
                        <i class="fas fa-times"></i> Reject Report
                    </button>
                    <button class="action-btn" onclick="runCode(${report.code_id})">
                        <i class="fas fa-play"></i> View Code
                    </button>
                </div>
            </div>
        `}).join('');
        
    } catch (error) {
        console.error('Error loading reports:', error);
        document.getElementById('reportsList').innerHTML = '<p>Error loading reports: ' + error.message + '</p>';
    }
}

async function reviewCode(codeId, approve) {
    try {
        console.log('Reviewing code:', { codeId, approve });
        
        const { error: updateError } = await supabaseClient
            .from('codes_oracode')
            .update({ 
                reviewed: approve,
                updated_at: new Date().toISOString()
            })
            .eq('id', codeId);

        if (updateError) {
            console.error('Error updating code:', updateError);
            throw updateError;
        }

        if (approve) {
            const { data: code, error: codeError } = await supabaseClient
                .from('codes_oracode')
                .select('user_id, title')
                .eq('id', codeId)
                .single();

            if (codeError) {
                console.error('Error fetching code details:', codeError);
            } else {
                const { error: notifError } = await supabaseClient
                    .from('notifications_oracode')
                    .insert([
                        {
                            user_id: code.user_id,
                            type: 'code_approved',
                            message: `Your code "${code.title}" has been approved and published!`,
                            data: { code_id: codeId, code_title: code.title },
                            read: false,
                            created_at: new Date().toISOString()
                        }
                    ]);

                if (notifError) {
                    console.warn('Notification error:', notifError);
                }
            }
        }

        alert(`Code ${approve ? 'approved' : 'rejected'} successfully!`);
        loadPendingReviews();
        
    } catch (error) {
        console.error('Error reviewing code:', error);
        alert('Failed to review code: ' + error.message);
    }
}

async function handleReport(reportId, status, codeId = null) {
    try {
        console.log('Handling report:', { reportId, status, codeId });
        
        const { error: reportError } = await supabaseClient
            .from('reports_oracode')
            .update({ 
                status: status,
                updated_at: new Date().toISOString()
            })
            .eq('id', reportId);

        if (reportError) {
            console.error('Error updating report:', reportError);
            throw reportError;
        }

        if (status === 'approved' && codeId) {
            console.log('Approving report, deleting code:', codeId);
            
            const { error: deleteError } = await supabaseClient
                .from('codes_oracode')
                .delete()
                .eq('id', codeId);

            if (deleteError) {
                console.error('Error deleting code:', deleteError);
                throw deleteError;
            }

            const { data: code, error: codeError } = await supabaseClient
                .from('codes_oracode')
                .select('user_id, title')
                .eq('id', codeId)
                .single();

            if (!codeError && code) {
                const { error: notifError } = await supabaseClient
                    .from('notifications_oracode')
                    .insert([
                        {
                            user_id: code.user_id,
                            type: 'code_removed',
                            message: `Your code "${code.title}" has been removed due to a report`,
                            data: { 
                                report_id: reportId,
                                code_id: codeId,
                                code_title: code.title 
                            },
                            read: false,
                            created_at: new Date().toISOString()
                        }
                    ]);

                if (notifError) {
                    console.warn('Notification error:', notifError);
                }
            }
        }

        const { data: report, error: reportFetchError } = await supabaseClient
            .from('reports_oracode')
            .select('user_id')
            .eq('id', reportId)
            .single();

        if (!reportFetchError && report) {
            const { error: notifError } = await supabaseClient
                .from('notifications_oracode')
                .insert([
                    {
                        user_id: report.user_id,
                        type: 'report_processed',
                        message: `Your report #${reportId} has been ${status}`,
                        data: { report_id: reportId, status: status },
                        read: false,
                        created_at: new Date().toISOString()
                    }
                ]);

            if (notifError) {
                console.warn('Notification error:', notifError);
            }
        }

        alert(`Report ${status} successfully!`);
        loadReports();
        
    } catch (error) {
        console.error('Error handling report:', error);
        alert('Failed to handle report: ' + error.message);
    }
}

// ==================== INITIALIZATION ====================
async function checkExistingSession() {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        
        if (session) {
            const { data: userData, error } = await supabaseClient
                .from('users_oracode')
                .select('*')
                .eq('id', session.user.id)
                .single();

            if (!error && userData) {
                currentUser = userData;
                updateUIForUser();
            }
        }
    } catch (error) {
        console.error('Error checking session:', error);
    }
}

checkExistingSession();
showFeed();
updateUIForUser();
