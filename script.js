
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut,
    GoogleAuthProvider,
    signInWithPopup 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";

let isLoginMode = true;
let currentUser = null;
let isGuest = false;
let isSyncing = false;
let saveTimeout = null; 
let currentLang = 'tr';
let currentTheme = {
    color: '#2c3e50',
    font: 'ptserif' 
};
let currentLayout = {
    fontSize: 11,
    lineHeight: 1.4,
    margin: 20,
    sectionGap: 15
};
let profilePhotoBase64 = null;
const appId = "mono-cv-app";

const escapeHTML = (str) => {
    if (!str) return "";
    return str.toString().replace(/[&<>"']/g, (m) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[m]));
};

const formatCvDate = (val) => {
    if (!val || val === 'undefined') return "";
    if (val === 'present') return currentLang === 'tr' ? 'Devam Ediyor' : 'Present';
    if (typeof val === 'string' && val.includes('-')) {
        const [year, month] = val.split('-');
        const months = currentLang === 'tr' 
            ? ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
            : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const mIdx = parseInt(month) - 1;
        if (months[mIdx]) return `${months[mIdx]} ${year}`;
    }
    return val;
};

window.toggleDateEnd = (checkbox) => {
    const input = checkbox.closest('.date-end-wrapper').querySelector('input[type="month"]');
    input.disabled = checkbox.checked;
    if (checkbox.checked) input.value = '';
    generateCVFromForm();
};

const firebaseConfig = {
    apiKey: "AIzaSyBbxgCMw5dO5T-kt7Njapo5ST04MRp7JKU",
    authDomain: "ats-friendly-93377.firebaseapp.com",
    projectId: "ats-friendly-93377",
    storageBucket: "ats-friendly-93377.firebasestorage.app",
    messagingSenderId: "542738169697",
    appId: "1:542738169697:web:a999680a273fdd90ab4f20"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app); 
const googleProvider = new GoogleAuthProvider();

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

window.handlePhotoUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        profilePhotoBase64 = e.target.result;
        document.getElementById('btn-remove-photo').style.display = 'inline-block';
        generateCVFromForm();
        triggerDebounceSave();
    };
    reader.readAsDataURL(file);
};

window.removePhoto = () => {
    profilePhotoBase64 = null;
    document.getElementById('inp-photo').value = '';
    document.getElementById('btn-remove-photo').style.display = 'none';
    generateCVFromForm();
    triggerDebounceSave();
};

window.handleCvUpload = async (event) => {
    const t = translations[currentLang];
    
    if (isGuest) {
        alert(t.msg_guest_import_warning);
        event.target.value = '';
        return;
    }

    const file = event.target.files[0];
    if (!file) return;

    const toast = document.getElementById('toast');
    
    toast.innerText = t.msg_importing;
    toast.classList.add('show');

    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = "";

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items.map(item => item.str).join(" ");
            fullText += pageText + "\n";
        }

        const parseResume = httpsCallable(functions, 'parseResumeWithAI');
        const result = await parseResume({ text: fullText });
        const parsedData = result.data;
        
        if (parsedData.fullname) document.getElementById('inp-fullname').value = parsedData.fullname;
        if (parsedData.title) document.getElementById('inp-title').value = parsedData.title;
        if (parsedData.email) document.getElementById('inp-email').value = parsedData.email;
        if (parsedData.phone) document.getElementById('inp-phone').value = parsedData.phone;
        if (parsedData.address) document.getElementById('inp-address').value = parsedData.address;
        if (parsedData.linkedin) document.getElementById('inp-linkedin').value = parsedData.linkedin;
        if (parsedData.summary) document.getElementById('inp-summary').value = parsedData.summary;

        if (parsedData.experiences && parsedData.experiences.length > 0) {
            document.getElementById('form-experiences-list').innerHTML = '';
            parsedData.experiences.forEach(exp => window.addFormExperience(exp));
            window.initDatePicker();
        }
        if (parsedData.education && parsedData.education.length > 0) {
            document.getElementById('form-education-list').innerHTML = '';
            parsedData.education.forEach(edu => window.addFormEducation(edu));
            window.initDatePicker();
        }

        window.generateCVFromForm();
        triggerDebounceSave();

        toast.innerText = t.msg_import_success;
        setTimeout(() => toast.classList.remove('show'), 3000);
        
    } catch (error) {
        console.error("AI CV Parsing Error:", error);
        toast.innerText = t.msg_import_error;
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    event.target.value = '';
};



const translations = {
    tr: {
        auth_title: "Hesabınıza Giriş Yapın",
        auth_subtitle_login: "CV'nizi düzenlemeye devam edin",
        auth_title_signup: "Hemen Ücretsiz Hesap Oluşturun",
        auth_subtitle_signup: "Kredi kartı gerekmez",
        auth_btn_login: "Giriş Yap",
        auth_btn_signup: "Kayıt Ol",
        auth_toggle_msg_login: "Hesabın yok mu?",
        auth_toggle_link_login: "Hemen Kayıt Ol",
        auth_toggle_msg_signup: "Zaten hesabın var mı?",
        auth_toggle_link_signup: "Giriş Yap",
        
        auth_processing: "İşleniyor...",
        tpl_select_header: "Profesyonel Bir Şablon Seçin",
        tpl_classic: "Klasik",
        tpl_classic_desc: "🏛️ Geleneksel",
        tpl_compact: "Kompakt",
        tpl_compact_desc: "📄 Minimal",
        tpl_modern: "Modern",
        tpl_modern_desc: "✨ Zarif",
        tpl_elegant: "Elegant",
        tpl_elegant_desc: "💎 Profesyonel",
        btn_design: "Tasarım Ayarları",
        btn_layout: "Sayfa Düzeni",
        btn_change_tpl: "Şablonu Değiştir",
        btn_download_pdf: "PDF İndir",
        btn_reset: "Sıfırla / Temizle",
        btn_clear: "Temizle",
        btn_logout: "Çıkış Yap",
        btn_guest: "Misafir Olarak Devam Et",
        nav_design: "TASARIM",
        nav_actions: "İŞLEMLER",
        status_connecting: "Bağlanıyor...",
        status_online: "Senkronize",
        msg_guest_import_warning: "CV yükleme özelliğini kullanmak için lütfen giriş yapın veya kayıt olun.",
        status_syncing: "Kaydediliyor...",
        status_saved: "Kaydedildi!",
        status_offline: "Çevrimdışı",
        cv_label_license: "Ehliyet",
        confirm_reset: "DİKKAT: CV içeriğiniz tamamen silinecek ve başlangıç haline dönecektir. Devam etmek istiyor musunuz?",
        toast_reset: "CV başarıyla sıfırlandı.",
        modal_theme_title: "Tasarım Ayarları",
        modal_layout_title: "Sayfa Düzeni",
        lbl_color: "Vurgu Rengi",
        lbl_font: "Yazı Tipi",
        lbl_fontsize: "Yazı Boyutu",
        lbl_lineheight: "Satır Aralığı",
        lbl_margin: "Kenar Boşluğu",
        lbl_sectiongap: "Bölüm Aralığı",
        btn_save_close: "Kapat",
        tab_edit: "Düzenle",
        tab_preview: "Önizle",
        landing_h1: "İşe Alım Robotlarını<br><span class='highlight-text'>Yenecek CV'nizi Oluşturun</span>",
        landing_subtitle: "Modern işe alım sistemleri (ATS) ile %100 uyumlu, profesyonel ve sade CV'ler hazırlayın. Üstelik tamamen ücretsiz.",
        btn_start_free: "Hemen Ücretsiz Başla",
        btn_how_it_works: "Nasıl Çalışır?",
        feat_1_title: "ATS Dostu Format",
        feat_1_desc: "Karmaşık grafikler yok. İnsan kaynakları yazılımlarının (ATS) kolayca okuyabileceği temiz kod yapısı.",
        feat_2_title: "%100 Ücretsiz",
        feat_2_desc: "Gizli ödeme yok, filigran yok. Sınırsız düzenleme ve PDF indirme hakkı.",
        feat_3_title: "Bulut Kayıt",
        feat_3_desc: "CV'niz bulutta güvende. İstediğiniz cihazdan (PC veya Mobil) kaldığınız yerden devam edin.",
        showcase_title: "Profesyonel Şablonlar",
        showcase_subtitle: "Size en uygun tasarımı seçin ve CV'nizi dakikalar içinde hazırlayın",
        badge_secure: "Güvenli Depolama",
        badge_secure_desc: "256-bit SSL Şifreleme",
        badge_no_sell: "Veri Satışı Yok",
        badge_no_sell_desc: "Bilgileriniz Sizinle Kalır",
        badge_gdpr: "GDPR & KVKK Uyumlu",
        badge_gdpr_desc: "Veri Koruma Standartları",
        form_title: "Bilgilerinizi Düzenleyin",
        form_personal: "Kişisel Bilgiler",
        form_profile: "Profil Özeti",
        form_experience: "İş Deneyimi",
        form_education: "Eğitim",
        form_custom: "Özel Bölümler",
        form_lbl_fullname: "Ad Soyad",
        form_lbl_title: "Unvan",
        form_lbl_email: "E-posta",
        form_lbl_phone: "Telefon",
        form_lbl_linkedin: "LinkedIn",
        form_lbl_address: "Adres",
        form_lbl_photo: "Profil Fotoğrafı",
        btn_choose_photo: "Fotoğraf Seç",
        btn_remove_photo: "Kaldır",
        btn_add_job: "İş Ekle",
        btn_add_edu: "Okul Ekle",
        btn_add_custom: "Bölüm Ekle",
        lbl_job_title: "Pozisyon Adı",
        lbl_company: "Şirket",
        lbl_date: "Tarih",
        lbl_desc: "Açıklama",
        lbl_school: "Okul / Üniversite",
        lbl_degree: "Bölüm / Derece",
        lbl_certificate_name: "Sertifika Adı",
        lbl_issuer: "Kurum / Yer",
        lbl_reference_name: "Referans Adı",
        lbl_reference_title: "Unvan / Şirket",
        lbl_reference_contact: "İletişim Bilgisi",
        lbl_section_title: "Bölüm Başlığı",
        lbl_section_content: "İçerik / Açıklama",
        form_certificates: "Sertifikalar",
        form_references: "Referanslar",
        btn_add_cert: "Sertifika Ekle",
        btn_add_ref: "Referans Ekle",
        btn_import_cv: "CV'den Aktar",
        lbl_date_start: "Başlangıç",
        lbl_date_end: "Bitiş",
        lbl_present: "Devam Ediyor",
        msg_importing: "CV analiz ediliyor...",
        msg_import_success: "Bilgiler başarıyla aktarıldı!",
        msg_import_error: "CV okuma hatası. Lütfen manuel doldurun.",
        btn_account: "Hesabım",
        modal_account_title: "Hesabım",
        menu_profile: "Profil Bilgilerim",
        menu_profile_desc: "Hesap ve e-posta ayarları",
        menu_faq: "Sıkça Sorulan Sorular",
        menu_faq_desc: "Yardım ve destek",
        menu_logout_desc: "Oturumu güvenli bir şekilde kapat",
        footer_faq: "Sıkça Sorulan Sorular",
        footer_privacy: "Gizlilik Politikası",
        footer_terms: "Kullanım Koşulları",
        footer_contact: "İletişim",
        faq_content: `
            <strong>🔒 Verilerim güvende mi?</strong><br>
            Evet! CV verileriniz Google Firebase'in güvenli bulut altyapısında şifrelenmiş olarak saklanır. Verileriniz sadece size aittir ve asla üçüncü taraflarla paylaşılmaz.<br><br>
            <strong>💰 Gerçekten tamamen ücretsiz mi?</strong><br>
            Kesinlikle! Gizli ücret, abonelik veya filigran yok. Sınırsız sayıda CV oluşturabilir, düzenleyebilir ve PDF olarak indirebilirsiniz.<br><br>
            <strong>🤖 ATS nedir ve neden önemli?</strong><br>
            ATS (Applicant Tracking System), şirketlerin başvuruları otomatik olarak taramak için kullandığı yazılımdır. Karmaşık grafikler ve tablolar içeren CV'ler ATS tarafından okunamaz. Bizim şablonlarımız, ATS'nin kolayca anlayabileceği temiz yapıya sahiptir.<br><br>
            <strong>📱 Mobil cihazlardan kullanabilir miyim?</strong><br>
            Elbette! Platform tamamen responsive tasarıma sahip. Bilgisayar, tablet veya telefon - hangi cihazı kullanırsanız kullanın, CV'nizi rahatlıkla düzenleyebilirsiniz.
        `,
        privacy_policy_title: "Gizlilik Politikası",
        privacy_policy_content: `Veri Toplama: Bu platform, yalnızca CV oluşturma amacıyla sağladığınız kişisel bilgileri (ad, iletişim, deneyim vb.) işler.<br><br>Veri Kullanımı: Bilgileriniz hiçbir şekilde üçüncü şahıslarla paylaşılmaz veya reklam amaçlı kullanılmaz.<br><br>Yerel Depolama: Verileriniz tarayıcınızın yerel depolama alanında (Local Storage) veya güvenli sunucularımızda saklanır. İstediğiniz zaman verilerinizi silebilirsiniz.<br><br>Çerezler: Deneyiminizi iyileştirmek için temel çerezler kullanılmaktadır.`,
        terms_of_service_title: "Kullanım Koşulları",
        terms_of_service_content: `Hizmet Tanımı: Bu web sitesi, kullanıcıların profesyonel özgeçmişler oluşturmasına yardımcı olan bir araçtır.<br><br>Sorumluluk: Kullanıcılar, CV'lerinde sağladıkları bilgilerin doğruluğundan kendileri sorumludur.<br><br>Fikri Mülkiyet: Şablon tasarımları ve platform kodları bu projeye aittir, izinsiz kopyalanamaz.<br><br>Değişiklikler: Hizmet şartları önceden haber verilmeksizin güncellenebilir.`,
        auth_terms_text: `<a href="javascript:void(0)" onclick="openPolicyModal('terms')">Kullanım Koşulları</a>'nı ve <a href="javascript:void(0)" onclick="openPolicyModal('privacy')">Gizlilik Politikasını</a> okudum, kabul ediyorum.`,
        linkedin_tip_text: "İpucu: LinkedIn profil linkinizi 'Genel profil ve URL' kısmından kopyalarsanız CV'nizde daha şık (temiz) görünecektir."
    },
    en: {
        auth_title: "Login to your account",
        auth_subtitle_login: "Continue editing your CV",
        auth_title_signup: "Create your free account",
        auth_subtitle_signup: "No credit card required",
        auth_btn_login: "Login",
        auth_btn_signup: "Sign Up",
        auth_toggle_msg_login: "Don't have an account?",
        auth_toggle_link_login: "Sign Up Now",
        auth_toggle_msg_signup: "Already have an account?",
        auth_toggle_link_signup: "Login",

        auth_processing: "Processing...",
        tpl_select_header: "Select a Professional Template",
        tpl_classic: "Classic",
        tpl_classic_desc: "🏛️ Traditional",
        tpl_compact: "Compact",
        tpl_compact_desc: "📄 Minimal",
        tpl_modern: "Modern",
        tpl_modern_desc: "✨ Stylish",
        tpl_elegant: "Elegant",
        tpl_elegant_desc: "💎 Professional",
        btn_design: "Design Settings",
        btn_layout: "Page Layout",
        btn_change_tpl: "Change Template",
        btn_download_pdf: "Download PDF",
        btn_reset: "Reset / Clear",
        btn_clear: "Clear",
        btn_logout: "Logout",
        btn_guest: "Continue as Guest",
        nav_design: "DESIGN",
        nav_actions: "ACTIONS",
        status_connecting: "Connecting...",
        status_online: "Synced",
        msg_guest_import_warning: "Please log in or sign up to use the CV upload feature.",
        status_syncing: "Saving...",
        status_saved: "Saved!",
        status_offline: "Offline",
        cv_label_license: "Driving license",
        confirm_reset: "WARNING: Your CV content will be erased and reset to default. Do you want to continue?",
        toast_reset: "CV successfully reset.",
        modal_theme_title: "Design Settings",
        modal_layout_title: "Page Layout",
        lbl_color: "Accent Color",
        lbl_font: "Font Family",
        lbl_fontsize: "Font Size",
        lbl_lineheight: "Line Height",
        lbl_margin: "Margin",
        lbl_sectiongap: "Section Gap",
        btn_save_close: "Close",
        tab_edit: "Edit",
        tab_preview: "Preview",
        landing_h1: "Build Your CV to<br><span class='highlight-text'>Beat Recruitment Robots</span>",
        landing_subtitle: "Create professional and simple CVs 100% compatible with modern recruitment systems (ATS). And it's completely free.",
        btn_start_free: "Start Free Now",
        btn_how_it_works: "How It Works?",
        feat_1_title: "ATS Friendly Format",
        feat_1_desc: "No complex graphics. Clean code structure that human resources software (ATS) can easily read.",
        feat_2_title: "100% Free",
        feat_2_desc: "No hidden payments, no watermarks. Unlimited editing and PDF download rights.",
        feat_3_title: "Cloud Save",
        feat_3_desc: "Your CV is safe in the cloud. Continue where you left off from any device (PC or Mobile).",
        showcase_title: "Professional Templates",
        showcase_subtitle: "Choose the design that suits you best and create your CV in minutes",
        badge_secure: "Secure Storage",
        badge_secure_desc: "256-bit SSL Encryption",
        badge_no_sell: "No Data Selling",
        badge_no_sell_desc: "Your Info Stays With You",
        badge_gdpr: "GDPR & KVKK Compliant",
        badge_gdpr_desc: "Data Protection Standards",
        form_title: "Edit Your Details",
        form_personal: "Personal Details",
        form_profile: "Professional Summary",
        form_experience: "Work Experience",
        form_education: "Education",
        form_custom: "Custom Sections",
        form_lbl_fullname: "Full Name",
        form_lbl_title: "Job Title",
        form_lbl_email: "Email",
        form_lbl_phone: "Phone",
        form_lbl_linkedin: "LinkedIn",
        form_lbl_address: "Address",
        form_lbl_photo: "Profile Photo",
        btn_choose_photo: "Choose Photo",
        btn_remove_photo: "Remove",
        btn_add_job: "Add Job",
        btn_add_edu: "Add Education",
        btn_add_custom: "Add Section",
        lbl_job_title: "Job Title",
        lbl_company: "Company",
        lbl_date: "Date",
        lbl_desc: "Description",
        lbl_school: "School / University",
        lbl_degree: "Degree / Field",
        lbl_certificate_name: "Certificate Name",
        lbl_issuer: "Issuer / Where",
        lbl_reference_name: "Reference Name",
        lbl_reference_title: "Title / Company",
        lbl_reference_contact: "Contact Info",
        lbl_section_title: "Section Title",
        lbl_section_content: "Content / Description",
        form_certificates: "Certificates",
        form_references: "References",
        btn_add_cert: "Add Certificate",
        btn_add_ref: "Add Reference",
        btn_import_cv: "Import from CV",
        lbl_date_start: "Start Date",
        lbl_date_end: "End Date",
        lbl_present: "Present",
        msg_importing: "Analyzing CV...",
        msg_import_success: "Info imported successfully!",
        msg_import_error: "Error reading CV. Please fill manually.",
        btn_account: "Account",
        modal_account_title: "My Account",
        menu_profile: "My Profile",
        menu_profile_desc: "Account and email settings",
        menu_faq: "FAQ",
        menu_faq_desc: "Help and support",
        menu_logout_desc: "Sign out securely",
        footer_faq: "FAQ",
        footer_privacy: "Privacy Policy",
        footer_terms: "Terms of Service",
        footer_contact: "Contact",
        faq_content: `
            <strong>🔒 Is my data safe?</strong><br>
            Yes! Your CV data is stored encrypted in Google Firebase's secure cloud infrastructure. Your data belongs only to you and is never shared with third parties.<br><br>
            <strong>💰 Is it really completely free?</strong><br>
            Absolutely! No hidden fees, subscriptions or watermarks. Unlimited CV creation, editing and PDF download.<br><br>
            <strong>🤖 What is ATS and why is it important?</strong><br>
            ATS (Applicant Tracking System) is software companies use to scan applications. CVs with complex graphics cannot be read by ATS. Our templates have a clean structure that ATS can easily understand.<br><br>
            <strong>📱 Can I use it from mobile devices?</strong><br>
            Of course! The platform has a fully responsive design. Computer, tablet or phone - whatever device you use, you can easily edit your CV.
        `,
        privacy_policy_title: "Privacy Policy",
        privacy_policy_content: `Data Collection: This platform processes only the personal information you provide (name, contact, experience, etc.) for the sole purpose of resume creation.<br><br>Data Usage: Your information is never shared with third parties or used for advertising purposes.<br><br>Storage: Your data is stored in your browser's Local Storage or on our secure servers. You can delete your data at any time.<br><br>Cookies: Essential cookies are used to enhance your user experience.`,
        terms_of_service_title: "Terms of Service",
        terms_of_service_content: `Service Description: This website is a tool designed to help users create professional resumes.<br><br>Responsibility: Users are solely responsible for the accuracy of the information provided in their resumes.<br><br>Intellectual Property: Template designs and platform code belong to this project and may not be copied without permission.<br><br>Changes: Terms of service may be updated without prior notice.`,
        auth_terms_text: `I have read and agree to the <a href="javascript:void(0)" onclick="openPolicyModal('terms')">Terms of Service</a> and <a href="javascript:void(0)" onclick="openPolicyModal('privacy')">Privacy Policy</a>.`,
        linkedin_tip_text: "Tip: For a cleaner look on your CV, copy your LinkedIn URL from the 'Public profile & URL' section of your profile."
    }
};

window.setLanguage = (lang) => {
    currentLang = lang;
    document.documentElement.lang = lang; 
    
    const t = translations[lang];

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const translation = t[key];
        if (translation) {
            if (translation.includes('<')) {
                el.innerHTML = translation;
            } else {
                el.innerText = translation;
            }
        }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (t[key]) el.placeholder = t[key];
    });

    document.querySelectorAll('[data-i18n-val]').forEach(el => {
        const key = el.getAttribute('data-i18n-val');
        if (t[key]) el.value = t[key];
    });

    document.querySelectorAll('[data-lang]').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });

    updateAuthUI();
    
    generateCVFromForm();
};

function updateAuthUI() {
    const t = translations[currentLang];
    const title = isLoginMode ? t.auth_title : t.auth_title_signup;
    const sub = isLoginMode ? t.auth_subtitle_login : t.auth_subtitle_signup;
    const btnText = isLoginMode ? t.auth_btn_login : t.auth_btn_signup;
    const toggleMsg = isLoginMode ? t.auth_toggle_msg_login : t.auth_toggle_msg_signup;
    const toggleLink = isLoginMode ? t.auth_toggle_link_login : t.auth_toggle_link_signup;

    document.getElementById('auth-title').innerText = title;
    document.getElementById('auth-subtitle').innerText = sub;
    document.getElementById('auth-btn-text').innerText = btnText;
    document.getElementById('auth-toggle-msg').innerText = toggleMsg;
    document.getElementById('auth-toggle-link').innerText = toggleLink;
    
    document.getElementById('terms-container').style.display = isLoginMode ? 'none' : 'block';
}

window.showView = (viewId) => {
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(viewId);
    if (target) {
        target.classList.add('active');
        if (viewId === 'editor-view' && window.innerWidth <= 1024) {
            window.switchMobileTab('edit');
        }
    }
};

window.switchMobileTab = (tab) => {
    const editorView = document.getElementById('editor-view');
    const tabEdit = document.getElementById('tab-edit');
    const tabPreview = document.getElementById('tab-preview');
    
    if (tab === 'edit') {
        editorView.classList.add('show-edit');
        editorView.classList.remove('show-preview');
        tabEdit.classList.add('active');
        tabPreview.classList.remove('active');
        document.getElementById('panel-form').scrollTop = 0;
    } else {
        editorView.classList.add('show-preview');
        editorView.classList.remove('show-edit');
        tabPreview.classList.add('active');
        tabEdit.classList.remove('active');
        setTimeout(window.resizePreview, 50);
    }
};

window.resizePreview = () => {
    // CRITICAL: This function is ONLY for screen preview, never for print
    // Print layout is handled 100% by CSS @media print rules
    
    const previewPanel = document.getElementById('panel-preview');
    const scaleContainer = document.getElementById('cv-scale-container');
    const cvRoot = document.getElementById('cv-root');

    if (!previewPanel || !scaleContainer || !cvRoot) return;
    
    // Check if we're in print mode - if so, do nothing
    if (document.body.classList.contains('printing')) return;

    // Desktop: no scaling needed
    if (window.innerWidth > 1024) {
        cvRoot.style.transform = 'none';
        cvRoot.style.transformOrigin = '';
        cvRoot.style.width = '794px'; // A4 width in pixels
        scaleContainer.style.width = 'auto';
        scaleContainer.style.height = 'auto';
        scaleContainer.style.marginTop = '0';
        scaleContainer.style.marginBottom = '0';
        return;
    }

    // Mobile: apply scale transform for preview only
    const originalWidth = 794; // A4 width = 210mm = 794px
    const horizontalPadding = 30; 
    const availableWidth = window.innerWidth - horizontalPadding;

    const scale = Math.min(1, availableWidth / originalWidth);
    
    cvRoot.style.transformOrigin = 'top left'; 
    cvRoot.style.transform = `scale(${scale})`;
    cvRoot.style.width = originalWidth + 'px'; 
    
    const scaledWidth = originalWidth * scale;
    const scaledHeight = cvRoot.getBoundingClientRect().height;

    scaleContainer.style.width = `${scaledWidth}px`;
    scaleContainer.style.height = `${scaledHeight}px`;
    
    scaleContainer.style.marginTop = '10px';
    scaleContainer.style.marginBottom = '100px'; 
    scaleContainer.style.marginLeft = '0';
    scaleContainer.style.marginRight = '0';
};

window.addEventListener('resize', window.resizePreview);

window.toggleFabMenu = () => {
    const items = document.getElementById('fab-items');
    const btn = document.getElementById('fab-trigger');
    const overlay = document.getElementById('fab-overlay');
    items.classList.toggle('show');
    btn.classList.toggle('active');
    overlay.classList.toggle('active');
};

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    const content = modal.querySelector('.modal-content');
    modal.classList.add('active');
    
    if (document.getElementById('fab-items')) {
        document.getElementById('fab-items').classList.remove('show');
        document.getElementById('fab-trigger').classList.remove('active');
        document.getElementById('fab-overlay').classList.remove('active');
    }

    if(window.innerWidth > 1024) {
        if (!content.style.top || !content.style.left) {
            content.style.top = "100px";
            const initialLeft = Math.max(20, window.innerWidth - 360);
            content.style.left = initialLeft + "px";
        }
        initDragElement(content);
    } else {
        content.style.top = '';
        content.style.left = '';
        content.style.transform = '';
    }
}

window.openLayoutModal = () => {
    try {
        if(document.getElementById('editor-view').classList.contains('active')) {
            generateCVFromForm(false);
        }
        
        document.getElementById('rng-fontsize').value = currentLayout.fontSize;
        document.getElementById('val-fontsize').innerText = currentLayout.fontSize + 'pt';

        document.getElementById('rng-lineheight').value = currentLayout.lineHeight;
        document.getElementById('val-lineheight').innerText = currentLayout.lineHeight;

        document.getElementById('rng-margin').value = currentLayout.margin;
        document.getElementById('val-margin').innerText = currentLayout.margin + 'mm';
        
        document.getElementById('rng-sectiongap').value = currentLayout.sectionGap;
        document.getElementById('val-sectiongap').innerText = currentLayout.sectionGap + 'px';

        openModal('layout-modal');
    } catch (error) {
        console.error('openLayoutModal error:', error);
        alert('Sayfa Düzeni açılırken hata oluştu: ' + error.message);
    }
};

window.closeLayoutModal = () => {
    document.getElementById('layout-modal').classList.remove('active');
    saveToCloud();
};

window.openAccountModal = () => openModal('account-modal');
window.closeAccountModal = () => document.getElementById('account-modal').classList.remove('active');

window.openProfile = () => {
    alert("Profil sayfası çok yakında!");
    closeAccountModal();
};

window.openFAQ = () => {
    openPolicyModal('faq');
    closeAccountModal();
};

window.openPolicyModal = (type) => {
    const t = translations[currentLang];
    const titleEl = document.getElementById('policy-title');
    const contentEl = document.getElementById('policy-content');
    
    if (type === 'privacy') {
        titleEl.innerText = t.privacy_policy_title;
        contentEl.innerHTML = t.privacy_policy_content;
    } else if (type === 'terms') {
        titleEl.innerText = t.terms_of_service_title;
        contentEl.innerHTML = t.terms_of_service_content;
    } else if (type === 'faq') {
        titleEl.innerText = t.faq_title;
        contentEl.innerHTML = t.faq_content;
    }
    
    openModal('policy-modal');
};

window.closePolicyModal = () => {
    document.getElementById('policy-modal').classList.remove('active');
};


function initDragElement(elmnt) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    const header = elmnt.querySelector(".modal-header");
    if (header) header.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }
    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
        elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
    }
    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

window.applyColor = (color) => {
    currentTheme.color = color;
    document.documentElement.style.setProperty('--cv-accent-color', color);
    triggerDebounceSave();
};

window.applyFont = (fontType) => {
    currentTheme.font = fontType;
    let fontVal = "'PT Serif', serif";
    switch(fontType) {
        case 'roboto': fontVal = "'Roboto', sans-serif"; break;
        case 'opensans': fontVal = "'Open Sans', sans-serif"; break;
        case 'montserrat': fontVal = "'Montserrat', sans-serif"; break;
        case 'lato': fontVal = "'Lato', sans-serif"; break;
        case 'raleway': fontVal = "'Raleway', sans-serif"; break;
        case 'playfair': fontVal = "'Playfair Display', serif"; break;
        case 'lora': fontVal = "'Lora', serif"; break;
        case 'merriweather': fontVal = "'Merriweather', serif"; break;
        case 'ptserif': default: fontVal = "'PT Serif', serif"; break;
    }
    document.documentElement.style.setProperty('--font-cv', fontVal);
    triggerDebounceSave();
};

window.updateLayout = () => {
    const fs = document.getElementById('rng-fontsize').value;
    const lh = document.getElementById('rng-lineheight').value;
    const mg = document.getElementById('rng-margin').value;
    const sg = document.getElementById('rng-sectiongap').value;

    currentLayout = { fontSize: fs, lineHeight: lh, margin: mg, sectionGap: sg };

    document.getElementById('val-fontsize').innerText = fs + 'pt';
    document.getElementById('val-lineheight').innerText = lh;
    document.getElementById('val-margin').innerText = mg + 'mm';
    document.getElementById('val-sectiongap').innerText = sg + 'px';

    document.documentElement.style.setProperty('--cv-font-size', fs + 'pt');
    document.documentElement.style.setProperty('--cv-line-height', lh);
    document.documentElement.style.setProperty('--cv-padding', mg + 'mm');
    document.documentElement.style.setProperty('--cv-section-gap', sg + 'px');
};

window.applySavedLayout = (layout) => {
    if(!layout) return;
    currentLayout = layout;
    document.documentElement.style.setProperty('--cv-font-size', layout.fontSize + 'pt');
    document.documentElement.style.setProperty('--cv-line-height', layout.lineHeight);
    document.documentElement.style.setProperty('--cv-padding', layout.margin + 'mm');
    document.documentElement.style.setProperty('--cv-section-gap', layout.sectionGap + 'px');
};

window.scrollToFeatures = () => {
    document.getElementById('features').scrollIntoView({ behavior: 'smooth' });
};

window.showAuth = (loginMode) => {
    if (currentUser) {
        window.showView('template-view');
        return;
    }
    isLoginMode = loginMode;
    updateAuthUI();
    window.showView('auth-view');
};

window.loginWithGoogle = async () => {
    try {
        updateStatus('syncing'); 
        await signInWithPopup(auth, googleProvider);
    } catch (e) {
        let msg = "Google Giriş Hatası: " + e.message;
        if(e.code === 'auth/popup-blocked') {
            msg = "Tarayıcınız açılır pencereyi engelledi. Lütfen izin verin.";
        } else if (e.code === 'auth/popup-closed-by-user') {
            msg = "Giriş işlemi iptal edildi.";
        }
        alert(msg);
        updateStatus('error');
    }
};

window.toggleAuthMode = () => {
    isLoginMode = !isLoginMode;
    updateAuthUI();
};

window.handleAuth = async () => {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const terms = document.getElementById('auth-terms').checked;
    const btnTextSpan = document.getElementById('auth-btn-text');
    const btn = document.querySelector('.auth-btn');
    
    if (!email || !password) return alert("Lütfen tüm alanları doldurun.");
    
    if (!isLoginMode && !terms) {
        return alert("Kayıt olmak için Kullanım Koşulları ve Gizlilik Politikasını kabul etmelisiniz.");
    }

    const originalText = btnTextSpan.innerText;
    btnTextSpan.innerText = translations[currentLang].auth_processing;
    btn.disabled = true;

    try {
        if (isLoginMode) {
            await signInWithEmailAndPassword(auth, email, password);
        } else {
            await createUserWithEmailAndPassword(auth, email, password);
        }
    } catch (e) { 
        alert("Hata: " + e.message);
        btnTextSpan.innerText = originalText;
        btn.disabled = false;
    }
};

window.logout = async () => {
    try {
        await signOut(auth);
        currentUser = null;
        isGuest = false;
        window.closeAccountModal();
        window.showView('landing-view');
    } catch (e) {
        console.error('Logout error:', e);
        alert("Çıkış hatası: " + e.message);
    }
};

window.continueAsGuest = () => {
    isGuest = true;
    window.showView('template-view');
};

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        isGuest = false;
        
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'data', 'cvContent');
        const snap = await getDoc(docRef);
        
        if (snap.exists()) {
            const data = snap.data();
            if (data.formData) loadUserDataIntoForm(data.formData);
            if (data.sectionSettings) {
                const ss = data.sectionSettings;
                if (ss.titles) {
                    document.getElementById('title-certificates').value = ss.titles.certs || 'Sertifikalar';
                    document.getElementById('title-references').value = ss.titles.refs || 'Referanslar';
                }
                if (ss.visible) {
                    document.getElementById('form-certificates-block').style.display = ss.visible.certs ? 'block' : 'none';
                    document.getElementById('form-references-block').style.display = ss.visible.refs ? 'block' : 'none';
                    document.getElementById('form-certificates-block').parentElement.style.opacity = ss.visible.certs ? '1' : '0.5';
                    document.getElementById('form-references-block').parentElement.style.opacity = ss.visible.refs ? '1' : '0.5';
                }
            }
            document.body.className = data.template || '';
            if (data.theme) {
                currentTheme = data.theme;
                window.applyColor(currentTheme.color);
                window.applyFont(currentTheme.font);
            }
            if (data.layout) applySavedLayout(data.layout);
        }
        
        updateStatus('online');

        const currentView = document.querySelector('.view-section.active');
        if (currentView && currentView.id === 'auth-view') {
            if (snap.exists()) {
                window.showView('editor-view');
                generateCVFromForm(false);
            } else {
                window.showView('template-view');
            }
        }
    } else {
        const currentView = document.querySelector('.view-section.active');
        if (!isGuest && (!currentView || currentView.id === 'editor-view' || currentView.id === 'template-view')) {
            window.showView('landing-view');
        }
    }
});

window.selectTemplate = (tpl) => {
    document.body.className = tpl;
    window.showView('editor-view');
    generateCVFromForm();
};

window.backToTemplates = () => {
    saveToCloud(); 
    window.showView('template-view');
};

window.addFormExperience = (data = null) => {
    const container = document.getElementById('form-experiences-list');
    const div = document.createElement('div');
    div.className = 'dynamic-item';
    const t = translations[currentLang];
    
    div.innerHTML = `
        <button class="remove-dynamic-btn" onclick="removeItemAndRefresh(this)" aria-label="Remove item">×</button>
        <div class="input-grid">
            <div class="input-group">
                <label data-i18n="lbl_job_title">${t.lbl_job_title}</label>
                <input type="text" class="form-input job-title" data-i18n-placeholder="lbl_job_title" placeholder="Ex: Manager" value="${(data?.title && data.title !== 'undefined') ? data.title : ''}" oninput="generateCVFromForm()">
            </div>
            <div class="input-group">
                <label data-i18n="lbl_company">${t.lbl_company}</label>
                <input type="text" class="form-input job-company" data-i18n-placeholder="lbl_company" placeholder="Ex: Google" value="${(data?.company && data.company !== 'undefined') ? data.company : ''}" oninput="generateCVFromForm()">
            </div>
            <div class="input-group">
                <label data-i18n="lbl_date_start">${t.lbl_date_start}</label>
                <input type="text" class="form-input job-date-start date-picker-month" value="${(data?.startDate && data.startDate !== 'undefined') ? data.startDate : ''}" oninput="generateCVFromForm()">
            </div>
            <div class="input-group">
                <label data-i18n="lbl_date_end">${t.lbl_date_end}</label>
                <div class="date-end-wrapper">
                    <input type="text" class="form-input job-date-end date-picker-month" value="${(data?.endDate && data.endDate !== 'undefined') ? data.endDate : ''}" oninput="generateCVFromForm()" ${data?.present ? 'disabled' : ''}>
                    <label class="present-label">
                        <input type="checkbox" class="job-present" onchange="toggleDateEnd(this)" ${data?.present ? 'checked' : ''}> <span data-i18n="lbl_present">${t.lbl_present}</span>
                    </label>
                </div>
            </div>
            <div class="input-group full-width">
                <label data-i18n="lbl_desc">${t.lbl_desc}</label>
                <textarea class="form-input job-desc" rows="3" oninput="generateCVFromForm()">${(data?.desc && data.desc !== 'undefined') ? data.desc : ''}</textarea>
            </div>
        </div>
    `;
    container.appendChild(div);
    if (!data) {
        generateCVFromForm();
        window.initDatePicker();
    }
};

window.addFormEducation = (data = null) => {
    const container = document.getElementById('form-education-list');
    const div = document.createElement('div');
    div.className = 'dynamic-item';
    const t = translations[currentLang];
    
    div.innerHTML = `
        <button class="remove-dynamic-btn" onclick="removeItemAndRefresh(this)" aria-label="Remove item">×</button>
        <div class="input-grid">
            <div class="input-group">
                <label data-i18n="lbl_school">${t.lbl_school}</label>
                <input type="text" class="form-input edu-school" data-i18n-placeholder="lbl_school" placeholder="Ex: MIT" value="${(data?.school && data.school !== 'undefined') ? data.school : ''}" oninput="generateCVFromForm()">
            </div>
            <div class="input-group">
                <label data-i18n="lbl_degree">${t.lbl_degree}</label>
                <input type="text" class="form-input edu-degree" data-i18n-placeholder="lbl_degree" placeholder="Ex: CS" value="${(data?.degree && data.degree !== 'undefined') ? data.degree : ''}" oninput="generateCVFromForm()">
            </div>
            <div class="input-group">
                <label data-i18n="lbl_date_start">${t.lbl_date_start}</label>
                <input type="text" class="form-input edu-date-start date-picker-month" value="${(data?.startDate && data.startDate !== 'undefined') ? data.startDate : ''}" oninput="generateCVFromForm()">
            </div>
            <div class="input-group">
                <label data-i18n="lbl_date_end">${t.lbl_date_end}</label>
                <input type="text" class="form-input edu-date-end date-picker-month" value="${(data?.endDate && data.endDate !== 'undefined') ? data.endDate : ''}" oninput="generateCVFromForm()">
            </div>
        </div>
    `;
    container.appendChild(div);
    if (!data) {
        generateCVFromForm();
        window.initDatePicker();
    }
};

window.addFormCustomSection = (data = null) => {
    const container = document.getElementById('form-custom-list');
    const div = document.createElement('div');
    div.className = 'dynamic-item';
    const t = translations[currentLang];
    
    div.innerHTML = `
        <button class="remove-dynamic-btn" onclick="removeItemAndRefresh(this)" aria-label="Remove item">×</button>
        <div class="input-group" style="margin-bottom:10px;">
            <label data-i18n="lbl_section_title">${t.lbl_section_title}</label>
            <input type="text" class="form-input custom-title" placeholder="Ex: Certificates" value="${data?.title || ''}" oninput="generateCVFromForm()">
        </div>
        <div class="input-group full-width">
            <label data-i18n="lbl_section_content">${t.lbl_section_content}</label>
            <textarea class="form-input custom-content" rows="3" placeholder="Details..." oninput="generateCVFromForm()">${data?.content || ''}</textarea>
        </div>
    `;
    container.appendChild(div);
    if (!data) generateCVFromForm();
};

window.addFormReference = (data = null) => {
    const container = document.getElementById('form-references-list');
    const div = document.createElement('div');
    div.className = 'dynamic-item';
    const t = translations[currentLang];
    
    div.innerHTML = `
        <button class="remove-dynamic-btn" onclick="removeItemAndRefresh(this)" aria-label="Remove item">×</button>
        <div class="input-grid">
            <div class="input-group">
                <label data-i18n="lbl_reference_name">${t.lbl_reference_name}</label>
                <input type="text" class="form-input ref-name" placeholder="Ex: John Doe" value="${data?.name || ''}" oninput="generateCVFromForm()">
            </div>
            <div class="input-group">
                <label data-i18n="lbl_reference_title">${t.lbl_reference_title}</label>
                <input type="text" class="form-input ref-title" placeholder="Ex: HR Manager" value="${data?.title || ''}" oninput="generateCVFromForm()">
            </div>
            <div class="input-group full-width">
                <label data-i18n="lbl_reference_contact">${t.lbl_reference_contact}</label>
                <input type="text" class="form-input ref-contact" placeholder="Ex: john@company.com" value="${data?.contact || ''}" oninput="generateCVFromForm()">
            </div>
        </div>
    `;
    container.appendChild(div);
    if (!data) generateCVFromForm();
};

window.addFormCertificate = (data = null) => {
    const container = document.getElementById('form-certificates-list');
    const div = document.createElement('div');
    div.className = 'dynamic-item';
    const t = translations[currentLang];
    
    div.innerHTML = `
        <button class="remove-dynamic-btn" onclick="removeItemAndRefresh(this)" aria-label="Remove item">×</button>
        <div class="input-grid">
            <div class="input-group">
                <label data-i18n="lbl_certificate_name">${t.lbl_certificate_name}</label>
                <input type="text" class="form-input cert-name" placeholder="Ex: PMP" value="${data?.name || ''}" oninput="generateCVFromForm()">
            </div>
            <div class="input-group">
                <label data-i18n="lbl_issuer">${t.lbl_issuer}</label>
                <input type="text" class="form-input cert-issuer" placeholder="Ex: PMI" value="${data?.issuer || ''}" oninput="generateCVFromForm()">
            </div>
            <div class="input-group full-width">
                <label data-i18n="lbl_date">${t.lbl_date}</label>
                <input type="text" class="form-input cert-date" placeholder="Ex: 2023" value="${data?.date || ''}" oninput="generateCVFromForm()">
            </div>
        </div>
    `;
    container.appendChild(div);
    if (!data) generateCVFromForm();
};

window.toggleSection = (id) => {
    const block = document.getElementById(id);
    const parent = block.parentElement;
    if (block.style.display === 'none') {
        block.style.display = 'block';
        parent.style.opacity = '1';
    } else {
        block.style.display = 'none';
        parent.style.opacity = '0.5';
    }
    generateCVFromForm();
};

window.removeItemAndRefresh = (btn) => {
    btn.parentElement.remove();
    generateCVFromForm();
};

window.generateCVFromForm = (triggerSave = true) => {
    const data = {
        fullname: document.getElementById('inp-fullname').value,
        title: document.getElementById('inp-title').value,
        email: document.getElementById('inp-email').value,
        phone: document.getElementById('inp-phone').value,
        linkedin: document.getElementById('inp-linkedin').value,
        address: document.getElementById('inp-address').value,
        license: document.getElementById('inp-license').value,
        summary: document.getElementById('inp-summary').value,
        photo: profilePhotoBase64,
        experiences: [],
        education: [],
        certificates: [],
        references: [],
        customSections: []
    };

    document.querySelectorAll('#form-experiences-list .dynamic-item').forEach(item => {
        data.experiences.push({
            title: item.querySelector('.job-title').value,
            company: item.querySelector('.job-company').value,
            startDate: item.querySelector('.job-date-start').value,
            endDate: item.querySelector('.job-date-end').value,
            present: item.querySelector('.job-present').checked,
            desc: item.querySelector('.job-desc').value
        });
    });

    document.querySelectorAll('#form-education-list .dynamic-item').forEach(item => {
        data.education.push({
            school: item.querySelector('.edu-school').value,
            degree: item.querySelector('.edu-degree').value,
            startDate: item.querySelector('.edu-date-start').value,
            endDate: item.querySelector('.edu-date-end').value
        });
    });

    document.querySelectorAll('#form-certificates-list .dynamic-item').forEach(item => {
        data.certificates.push({
            name: item.querySelector('.cert-name').value,
            issuer: item.querySelector('.cert-issuer').value,
            date: item.querySelector('.cert-date').value
        });
    });

    document.querySelectorAll('#form-references-list .dynamic-item').forEach(item => {
        data.references.push({
            name: item.querySelector('.ref-name').value,
            title: item.querySelector('.ref-title').value,
            contact: item.querySelector('.ref-contact').value
        });
    });

    document.querySelectorAll('#form-custom-list .dynamic-item').forEach(item => {
        data.customSections.push({
            title: item.querySelector('.custom-title').value,
            content: item.querySelector('.custom-content').value
        });
    });

    const titles = {
        certs: document.getElementById('title-certificates').value,
        refs: document.getElementById('title-references').value
    };

    const visible = {
        certs: document.getElementById('form-certificates-block').style.display !== 'none',
        refs: document.getElementById('form-references-block').style.display !== 'none'
    };

    const isModern = document.body.classList.contains('tpl-modern');
    const isCompact = document.body.classList.contains('tpl-compact');
    const isElegant = document.body.classList.contains('tpl-elegant');
    let html = "";
    
    const h = (str, allowNewlines = false) => {
        let escaped = escapeHTML(str);
        return allowNewlines ? escaped.replace(/\n/g, '<br>') : escaped;
    };

    const labels = {
        exp: currentLang === 'tr' ? 'İŞ DENEYİMİ' : 'EMPLOYMENT HISTORY',
        edu: currentLang === 'tr' ? 'EĞİTİM' : 'EDUCATION',
        prof: currentLang === 'tr' ? 'ÖZET' : 'SUMMARY',
        lic: translations[currentLang].cv_label_license
    };

    let expContent = "";
    if (data.experiences.length > 0) {
        let entries = data.experiences.map(exp => {
            const dateStr = `${formatCvDate(exp.startDate)} — ${exp.present ? formatCvDate('present') : formatCvDate(exp.endDate)}`;
            
            if (isModern) {
                const descLines = exp.desc.split('\n').filter(line => line.trim() !== '');
                const descHtml = descLines.length > 0 
                    ? `<ul>${descLines.map(line => `<li>${h(line.trim())}</li>`).join('')}</ul>` 
                    : '';
                
                return `
                <div class="modern-entry">
                    <div class="modern-entry-date">${h(dateStr)}</div>
                    <div class="modern-entry-content">
                        <div class="modern-job-title">${h(exp.title)}</div>
                        <div class="modern-company">${h(exp.company)}</div>
                        <div class="modern-desc">${descHtml}</div>
                    </div>
                </div>`;
            }
            
            return `
            <div class="entry">
                <div class="left-col">${h(dateStr)}</div>
                <div class="right-col"><h3>${h(exp.title)}, ${h(exp.company)}</h3><p>${h(exp.desc, true)}</p></div>
            </div>`;
        }).join('');
        
        if (isModern) {
            expContent = `
                <div class="modern-section">
                    <div class="modern-section-header"><span>${labels.exp}</span></div>
                    <div class="modern-section-body">${entries}</div>
                </div>`;
        } else {
            expContent = `
                <div class="section">
                    <div class="section-header"><span class="section-title">${labels.exp}</span></div>
                    ${entries}
                </div>`;
        }
    }

    let eduContent = "";
    if (data.education.length > 0) {
        let entries = data.education.map(edu => {
            const dateStr = `${formatCvDate(edu.startDate)} — ${formatCvDate(edu.endDate)}`;
            
            if (isModern) {
                return `
                <div class="modern-entry">
                    <div class="modern-entry-date">${h(dateStr)}</div>
                    <div class="modern-entry-content">
                        <div class="modern-job-title">${h(edu.degree)}</div>
                        <div class="modern-company">${h(edu.school)}</div>
                    </div>
                </div>`;
            }
            
            return `
            <div class="entry">
                <div class="left-col">${h(dateStr)}</div>
                <div class="right-col"><h3>${h(edu.degree)}</h3><p>${h(edu.school)}</p></div>
            </div>`;
        }).join('');

        if (isModern) {
            eduContent = `
                <div class="modern-section">
                    <div class="modern-section-header"><span>${labels.edu}</span></div>
                    <div class="modern-section-body">${entries}</div>
                </div>`;
        } else {
            eduContent = `
                <div class="section">
                    <div class="section-header"><span class="section-title">${labels.edu}</span></div>
                    ${entries}
                </div>`;
        }
    }

    let customContent = "";
    if (data.customSections.length > 0) {
        customContent = data.customSections.map(sec => {
            if (isModern) {
                return `
                <div class="modern-section">
                    <div class="modern-section-header"><span>${h(sec.title.toUpperCase())}</span></div>
                    <div class="modern-section-body">
                        <div class="modern-entry">
                            <div class="modern-entry-date"></div>
                            <div class="modern-entry-content">
                                <p>${h(sec.content, true)}</p>
                            </div>
                        </div>
                    </div>
                </div>`;
            }
            return `
            <div class="section">
                <div class="section-header"><span class="section-title">${h(sec.title)}</span></div>
                <div class="entry">
                    <div class="right-col"><p>${h(sec.content, true)}</p></div>
                </div>
            </div>`;
        }).join('');
    }

    let certContent = "";
    if (visible.certs && data.certificates.length > 0) {
        let entries = data.certificates.map(cert => {
            if (isModern) {
                return `
                <div class="modern-entry">
                    <div class="modern-entry-date">${h(cert.date)}</div>
                    <div class="modern-entry-content">
                        <div class="modern-job-title">${h(cert.name)}</div>
                        <div class="modern-company">${h(cert.issuer)}</div>
                    </div>
                </div>`;
            }
            return `
            <div class="entry">
                <div class="left-col">${h(cert.date)}</div>
                <div class="right-col"><h3>${h(cert.name)}</h3><p>${h(cert.issuer)}</p></div>
            </div>`;
        }).join('');
        
        if (isModern) {
            certContent = `<div class="modern-section"><div class="modern-section-header"><span>${h(titles.certs.toUpperCase())}</span></div><div class="modern-section-body">${entries}</div></div>`;
        } else {
            certContent = `<div class="section"><div class="section-header"><span class="section-title">${h(titles.certs)}</span></div>${entries}</div>`;
        }
    }

    let refContent = "";
    if (visible.refs && data.references.length > 0) {
        let entries = data.references.map(ref => {
            if (isModern) {
                return `
                <div class="modern-entry">
                    <div class="modern-entry-date"></div>
                    <div class="modern-entry-content">
                        <div class="modern-job-title">${h(ref.name)}</div>
                        <div class="modern-company">${h(ref.title)} | ${h(ref.contact)}</div>
                    </div>
                </div>`;
            }
            return `
            <div class="entry">
                <div class="right-col"><h3>${h(ref.name)}</h3><p>${h(ref.title)} | ${h(ref.contact)}</p></div>
            </div>`;
        }).join('');
        
        if (isModern) {
            refContent = `<div class="modern-section"><div class="modern-section-header"><span>${h(titles.refs.toUpperCase())}</span></div><div class="modern-section-body">${entries}</div></div>`;
        } else {
            refContent = `<div class="section"><div class="section-header"><span class="section-title">${h(titles.refs)}</span></div>${entries}</div>`;
        }
    }

    if (isModern) {
        html = `
        <div class="modern-layout">
            <header class="modern-header">
                ${data.photo ? `<div class="modern-photo"><img src="${data.photo}" alt="Profile Photo"></div>` : ''}
                <h1>${h(data.fullname) || 'ADINIZ SOYADINIZ'}</h1>
                <div class="modern-subtitle">${h(data.title)}</div>
                <div class="modern-contact">
                    <div>
                        <span>${h(data.address)}</span> | <span>${h(data.phone)}</span> | <span>${h(data.email)}</span>
                    </div>
                    ${data.linkedin ? `<div class="modern-linkedin-row"><span class="modern-linkedin">${h(data.linkedin)}</span></div>` : ''}
                </div>
            </header>
            
            <div class="modern-content">
                <div class="modern-section">
                    <div class="modern-section-header"><span>${labels.prof}</span></div>
                    <div class="modern-section-body">
                        <div class="modern-entry">
                            <div class="modern-entry-date"></div>
                            <div class="modern-entry-content">
                                <p class="modern-summary-text">${h(data.summary, true)}</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                ${expContent}
                ${eduContent}
                ${certContent}
                ${refContent}
                ${customContent}
            </div>
        </div>`;
    } else if (isCompact) {
        html = `
        <header>
            ${data.photo ? `<div class="cv-photo"><img src="${data.photo}" alt="Profile Photo"></div>` : ''}
            <h1>${h(data.fullname) || 'ADINIZ SOYADINIZ'}</h1>
            <div class="subtitle">${h(data.title)}</div>
            <div class="address-line">${h(data.address)}</div>
            <div class="contact-row">
                <span>${h(data.phone)}</span>
                <span>${h(data.email)}</span>
                ${data.linkedin ? `<span>${h(data.linkedin)}</span>` : ''}
            </div>
            <div class="compact-separator"></div>
            <div class="personal-details">
                <div class="detail-item"><span class="lbl">${labels.lic}</span><span class="dots"></span><span class="val">${h(data.license)}</span></div>
            </div>
        </header>
        <div id="main-content">
             <div class="section">
                <div class="section-header"><span class="section-title">${labels.prof}</span></div>
                <div class="entry"><div class="right-col">${h(data.summary, true)}</div></div>
            </div>
            ${expContent}
            ${eduContent}
            ${certContent}
            ${refContent}
            ${customContent}
        </div>`;
    } else if (document.body.classList.contains('tpl-elegant')) {
        html = `
        <header>
            ${data.photo ? `<div class="cv-photo"><img src="${data.photo}" alt="Profile Photo"></div>` : ''}
            <h1>${h(data.fullname) || 'ADINIZ SOYADINIZ'}</h1>
            <div class="subtitle">${h(data.title)}</div>
            <div class="contact-info">
                <span>✉️ ${h(data.email)}</span> | <span>📞 ${h(data.phone)}</span> | <span>📍 ${h(data.address)}</span>
                ${data.linkedin ? ` | <span>🔗 ${h(data.linkedin)}</span>` : ''}
            </div>
            ${data.license ? `<div class="elegant-license"><strong>${labels.lic}:</strong> ${h(data.license)}</div>` : ''}
        </header>
        <div id="main-content">
             <div class="section">
                <div class="section-header"><span class="section-title">${labels.prof}</span></div>
                <div class="entry"><div class="right-col">${h(data.summary, true)}</div></div>
            </div>
            ${expContent}
            ${eduContent}
            ${certContent}
            ${refContent}
            ${customContent}
        </div>`;
    } else {
        html = `
        <header>
            ${data.photo ? `<div class="cv-photo"><img src="${data.photo}" alt="Profile Photo"></div>` : ''}
            <h1>${h(data.fullname) || 'ADINIZ SOYADINIZ'}</h1>
            <div class="subtitle">${h(data.title)}</div>
            <div class="contact-info">
                <span>📍 ${h(data.address)}</span> | <span>📞 ${h(data.phone)}</span> | <span>✉️ ${h(data.email)}</span>
                ${data.linkedin ? ` | <span>🔗 ${h(data.linkedin)}</span>` : ''}
            </div>
            <div class="address-line" style="display:none">${h(data.address)}</div>
            <div class="contact-row" style="display:none">
                <span>${h(data.phone)}</span>
                <span>${h(data.email)}</span>
                ${data.linkedin ? `<span>${h(data.linkedin)}</span>` : ''}
            </div>
            <div class="personal-details" style="display:none">
                <div class="detail-item"><span class="lbl">${labels.lic}</span><span class="dots"></span><span class="val">${h(data.license)}</span></div>
            </div>
        </header>
        <div id="main-content">
             <div class="section">
                <div class="section-header"><span class="section-title">${labels.prof}</span></div>
                <div class="entry"><div class="right-col">${h(data.summary, true)}</div></div>
            </div>
            ${expContent}
            ${eduContent}
            ${certContent}
            ${refContent}
            ${customContent}
        </div>`;
    }

    document.getElementById('cv-root').innerHTML = html;
    
    if(window.innerWidth <= 1024) {
        setTimeout(window.resizePreview, 10);
    }

    if (triggerSave) {
        triggerDebounceSave(data);
    }
};

function loadUserDataIntoForm(data) {
    document.getElementById('inp-fullname').value = data.fullname || '';
    document.getElementById('inp-title').value = data.title || '';
    document.getElementById('inp-email').value = data.email || '';
    document.getElementById('inp-phone').value = data.phone || '';
    document.getElementById('inp-linkedin').value = data.linkedin || '';
    document.getElementById('inp-address').value = data.address || '';
    document.getElementById('inp-license').value = data.license || '';
    document.getElementById('inp-summary').value = data.summary || '';

    if (data.photo) {
        profilePhotoBase64 = data.photo;
        document.getElementById('btn-remove-photo').style.display = 'inline-block';
    } else {
        profilePhotoBase64 = null;
        document.getElementById('btn-remove-photo').style.display = 'none';
    }

    const expList = document.getElementById('form-experiences-list');
    expList.innerHTML = '';
    if (data.experiences) {
        data.experiences.forEach(exp => addFormExperience(exp));
    }

    const eduList = document.getElementById('form-education-list');
    eduList.innerHTML = '';
    if (data.education) {
        data.education.forEach(edu => addFormEducation(edu));
    }
    window.initDatePicker();

    const certList = document.getElementById('form-certificates-list');
    certList.innerHTML = '';
    if (data.certificates) {
        data.certificates.forEach(cert => addFormCertificate(cert));
    }

    const refList = document.getElementById('form-references-list');
    refList.innerHTML = '';
    if (data.references) {
        data.references.forEach(ref => addFormReference(ref));
    }

    const customList = document.getElementById('form-custom-list');
    customList.innerHTML = '';
    if (data.customSections) {
        data.customSections.forEach(sec => addFormCustomSection(sec));
    }
}

function triggerDebounceSave(data = null) {
    if (saveTimeout) clearTimeout(saveTimeout);
    updateStatus('syncing');
    saveTimeout = setTimeout(() => {
        saveToCloud(data);
    }, 2000);
}

async function saveToCloud(formData = null) {
    if (!currentUser) {
        if (isGuest && document.getElementById('editor-view').classList.contains('active')) {
            updateStatus('online'); 
        }
        return;
    }
    isSyncing = true;
    const docRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'data', 'cvContent');
    const sectionSettings = {
        titles: {
            certs: document.getElementById('title-certificates').value,
            refs: document.getElementById('title-references').value
        },
        visible: {
            certs: document.getElementById('form-certificates-block').style.display !== 'none',
            refs: document.getElementById('form-references-block').style.display !== 'none'
        }
    };

    try {
        await setDoc(docRef, { 
            formData: formData, 
            sectionSettings: sectionSettings,
            template: document.body.className,
            theme: currentTheme,
            layout: currentLayout,
            updatedAt: new Date().toISOString() 
        }, { merge: true });
        
        updateStatus('online');
        
        if (document.getElementById('editor-view').classList.contains('active')) {
            const t = document.getElementById('toast');
            t.innerText = translations[currentLang].status_saved;
            t.classList.add('show');
            setTimeout(() => t.classList.remove('show'), 2000);
        }

    } catch (e) { 
        updateStatus('error'); 
        console.error("Save failed:", e);
    } finally {
        isSyncing = false;
    }
}

function updateStatus(state) {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    if (!dot || !text) return;

    dot.className = 'status-dot';
    const t = translations[currentLang];
    
    if (state === 'online') {
        dot.classList.add('status-online');
        text.innerText = t.status_online;
    } else if (state === 'syncing') {
        dot.classList.add('status-syncing');
        text.innerText = t.status_syncing;
    } else {
        text.innerText = t.status_offline;
    }
}

window.resetAll = async (skipConfirm = false) => {
    if(!skipConfirm && !confirm(translations[currentLang].confirm_reset)) return;
    
    const inputs = document.querySelectorAll('.form-input');
    inputs.forEach(i => i.value = '');
    
    profilePhotoBase64 = null;
    document.getElementById('btn-remove-photo').style.display = 'none';
    
    document.getElementById('form-experiences-list').innerHTML = '';
    document.getElementById('form-education-list').innerHTML = '';
    document.getElementById('form-certificates-list').innerHTML = '';
    document.getElementById('form-references-list').innerHTML = '';
    document.getElementById('form-custom-list').innerHTML = '';
    
    document.getElementById('title-certificates').value = translations[currentLang].form_certificates;
    document.getElementById('title-references').value = translations[currentLang].form_references;
    
    document.getElementById('form-certificates-block').style.display = 'block';
    document.getElementById('form-references-block').style.display = 'block';
    document.getElementById('form-certificates-block').parentElement.style.opacity = '1';
    document.getElementById('form-references-block').parentElement.style.opacity = '1';
    
    generateCVFromForm();
    if(!skipConfirm) {
        const t = document.getElementById('toast');
        t.innerText = translations[currentLang].toast_reset;
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 3000);
    }
};

window.initDatePicker = () => {
    if (typeof flatpickr !== 'undefined') {
        // Destroy existing flatpickr instances to prevent duplicates
        document.querySelectorAll('.date-picker-month').forEach(input => {
            if (input._flatpickr) {
                input._flatpickr.destroy();
            }
        });
        
        // Initialize flatpickr on all date picker inputs
        flatpickr(".date-picker-month", {
            plugins: [
                new monthSelectPlugin({
                    shorthand: true, 
                    dateFormat: "Y-m", 
                    altFormat: "F Y", 
                    theme: "light"
                })
            ],
            locale: currentLang === 'tr' ? 'tr' : 'en',
            maxDate: "today", 
            onChange: function(selectedDates, dateStr, instance) {
                instance.element.value = dateStr;
                generateCVFromForm();
            }
        });
    }
};

setLanguage('tr');
window.resizePreview();
window.initDatePicker();

// ============================================
// PRINT EVENT HANDLERS
// ============================================
// CRITICAL ARCHITECTURAL RULE:
// Print output must be 100% CSS-driven, zero JavaScript manipulation
// All transforms, scales, and sizing are handled by @media print in CSS
// These events are ONLY for state management, not layout changes

let originalViewport = null;

window.addEventListener('beforeprint', () => {
    // Regenerate CV with latest form data
    if (window.generateCVFromForm) window.generateCVFromForm(false);
    
    // Add print class for CSS targeting
    document.body.classList.add('printing');
    
    // DO NOT manipulate DOM styles here!
    // All print layout is handled by @media print CSS rules
    // This ensures consistent A4 output across all browsers
});

window.addEventListener('afterprint', () => {
    // Remove print class
    document.body.classList.remove('printing');
    
    // Restore preview scaling for screen
    if (window.resizePreview) window.resizePreview();
});

