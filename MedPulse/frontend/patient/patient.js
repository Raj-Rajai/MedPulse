/* MedPulse · Patient portal (CRM) */
(function () {
  'use strict';

  requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.remove('preload-transitions')));

  /* ================= State ================= */
  const state = { card: null, records: null, family: null, notifs: [], requests: [], hospital: null, departments: [], reasons: [] };
  const TABS = ['overview', 'profile', 'family', 'hospital', 'campaigns', 'records'];
  const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];

  /* ================= Helpers ================= */
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const digits = (p) => String(p || '').replace(/\D/g, '');
  const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || 'there';
  const initials = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const genderLabel = (g) => ({ M: 'Male', F: 'Female', Male: 'Male', Female: 'Female' }[g] || (g ? 'Other' : ''));
  const AV_COLORS = ['#0284c7', '#7c3aed', '#db2777', '#059669', '#d97706', '#4f46e5', '#0d9488', '#b91c1c'];
  const avColor = (s) => AV_COLORS[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % AV_COLORS.length];
  const originalText = new WeakMap();
  const originalAttr = new WeakMap();
  let currentLang = 'en';
  let translating = false;
  let translateTimer = null;
  let languageObserver = null;
  const GU = {
    exact: {
      'Skip to patient content': 'દર્દી વિભાગ પર જાઓ',
      'HEALTH PORTAL': 'હેલ્થ પોર્ટલ',
      'Overview': 'સારાંશ',
      'My Health Card': 'મારું હેલ્થ કાર્ડ',
      'My Family': 'મારો પરિવાર',
      'Call Hospital': 'હોસ્પિટલને કોલ કરો',
      'Health Camps': 'હેલ્થ કેમ્પ',
      'Health Records': 'હેલ્થ રેકોર્ડ',
      'YOUR PATIENT PORTAL': 'તમારું દર્દી પોર્ટલ',
      'Your health, in one place.': 'તમારી આરોગ્ય માહિતી, એક જ જગ્યાએ.',
      'Stay connected to your care, your family and your hospital.': 'તમારી સારવાર, પરિવાર અને હોસ્પિટલ સાથે જોડાયેલા રહો.',
      'Language': 'ભાષા',
      'English': 'English',
      'MedPulse Care': 'મેડપલ્સ કેર',
      'Welcome': 'સ્વાગત છે',
      'Loading...': 'લોડ થઈ રહ્યું છે...',
      'My card': 'મારું કાર્ડ',
      'Sign out': 'સાઇન આઉટ',
      'Health Card': 'હેલ્થ કાર્ડ',
      'Hospital': 'હોસ્પિટલ',
      'Camps': 'કેમ્પ',
      'Records': 'રેકોર્ડ',
      'Needs your attention': 'તમારા ધ્યાનની જરૂર છે',
      'Things waiting on you.': 'તમારી તરફથી બાકી બાબતો.',
      'Your latest health numbers': 'તમારા તાજા આરોગ્ય આંકડા',
      'From your last check-up.': 'તમારા છેલ્લા ચેકઅપમાંથી.',
      'Your hospital': 'તમારી હોસ્પિટલ',
      'Requests': 'વિનંતીઓ',
      'Your family': 'તમારો પરિવાર',
      'Open': 'ખોલો',
      'Next health camp': 'આગામી હેલ્થ કેમ્પ',
      'See all': 'બધું જુઓ',
      'Print card': 'કાર્ડ પ્રિન્ટ કરો',
      'Copy patient ID': 'દર્દી ID કોપી કરો',
      'Your details': 'તમારી વિગતો',
      "These appear on your card. Your phone number is your login, so it can't be changed here.": 'આ વિગતો તમારા કાર્ડ પર દેખાશે. તમારો ફોન નંબર લોગિન છે, તેથી અહીં બદલી શકાતો નથી.',
      'Basic': 'મૂળભૂત',
      'Full name *': 'પૂરું નામ *',
      'Please enter your name.': 'કૃપા કરીને તમારું નામ દાખલ કરો.',
      'Date of birth': 'જન્મ તારીખ',
      "Date of birth can't be in the future.": 'જન્મ તારીખ ભવિષ્યની હોઈ શકતી નથી.',
      'Gender': 'લિંગ',
      'Male': 'પુરુષ',
      'Female': 'સ્ત્રી',
      'Other': 'અન્ય',
      'Blood group': 'બ્લડ ગ્રુપ',
      'Contact': 'સંપર્ક',
      'Mobile (login)': 'મોબાઇલ (લોગિન)',
      'Email': 'ઇમેઇલ',
      'optional': 'વૈકલ્પિક',
      'Enter a valid email.': 'માન્ય ઇમેઇલ દાખલ કરો.',
      'Address': 'સરનામું',
      'Emergency contact': 'આપાતકાલીન સંપર્ક',
      'Name': 'નામ',
      'Relation': 'સંબંધ',
      'Select': 'પસંદ કરો',
      'Spouse': 'જીવનસાથી',
      'Son': 'પુત્ર',
      'Daughter': 'પુત્રી',
      'Father': 'પિતા',
      'Mother': 'માતા',
      'Brother': 'ભાઈ',
      'Sister': 'બહેન',
      'Friend': 'મિત્ર',
      'Neighbour': 'પાડોશી',
      'Mobile': 'મોબાઇલ',
      "Enter a 10-digit mobile that isn't your own.": 'તમારા સિવાયનો 10 અંકનો મોબાઇલ દાખલ કરો.',
      'Save details': 'વિગતો સાચવો',
      'Request a call from the hospital': 'હોસ્પિટલથી કોલની વિનંતી કરો',
      'The hospital helpdesk will call or message you back.': 'હોસ્પિટલ હેલ્પડેસ્ક તમને કોલ અથવા મેસેજ કરશે.',
      'Who is it for?': 'આ કોના માટે છે?',
      'Department': 'વિભાગ',
      'What do you need?': 'તમને શું જોઈએ છે?',
      'How should they reach you?': 'તેઓ તમને કેવી રીતે સંપર્ક કરે?',
      'Call me back': 'મને પાછો કોલ કરો',
      'WhatsApp': 'વોટ્સએપ',
      'Best time': 'સારો સમય',
      'Any time': 'કોઈપણ સમય',
      'Morning (8-12)': 'સવાર (8-12)',
      'Afternoon (12-4)': 'બપોર (12-4)',
      'Evening (4-8)': 'સાંજ (4-8)',
      'Message': 'સંદેશ',
      '(optional)': '(વૈકલ્પિક)',
      'For a medical emergency, seek immediate care at the nearest emergency department. Do not wait for a callback.': 'તાત્કાલિક તબીબી સ્થિતિમાં નજીકના ઇમરજન્સી વિભાગમાં તરત જ જાઓ. પાછા કોલની રાહ ન જુઓ.',
      'Send to hospital': 'હોસ્પિટલને મોકલો',
      'Your requests': 'તમારી વિનંતીઓ',
      'Only what\'s relevant to you.': 'ફક્ત તમારા માટે સંબંધિત માહિતી.',
      'You get a camp alert only when it matches a condition or reading in your health record.': 'તમારા હેલ્થ રેકોર્ડની સ્થિતિ અથવા રીડિંગ સાથે મેળ થાય ત્યારે જ તમને કેમ્પ એલર્ટ મળશે.',
      'Upcoming': 'આગામી',
      'Past camps': 'જૂના કેમ્પ',
      'Medicines': 'દવાઓ',
      'Conditions': 'સ્થિતિઓ',
      'Allergies': 'એલર્જી',
      'Check-up visits': 'ચેકઅપ મુલાકાતો',
      'Follow-up visits recorded in your health survey.': 'તમારા હેલ્થ સર્વેમાં નોંધાયેલી ફોલો-અપ મુલાકાતો.',
      'Add family member': 'પરિવાર સભ્ય ઉમેરો',
      'Full name': 'પૂરું નામ',
      'Relation to you *': 'તમારા સાથેનો સંબંધ *',
      'Gender *': 'લિંગ *',
      'or age (years)': 'અથવા ઉંમર (વર્ષ)',
      'Marital status': 'વૈવાહિક સ્થિતિ',
      'Unknown': 'ખબર નથી',
      'Single': 'અવિવાહિત',
      'Married': 'વિવાહિત',
      'Widowed': 'વિધવા/વિધુર',
      'Divorced': 'છૂટાછેડા લીધેલ',
      'Occupation': 'વ્યવસાય',
      'Education': 'શિક્ષણ',
      'Cancel': 'રદ કરો',
      'Save': 'સાચવો',
      'Family details': 'પરિવાર વિગતો',
      'Family name': 'પરિવારનું નામ',
      'House / street': 'ઘર / શેરી',
      'Village / area': 'ગામ / વિસ્તાર',
      'City': 'શહેર',
      'District': 'જિલ્લો',
      'PIN code': 'પિન કોડ',
      'Connect your health survey': 'તમારો હેલ્થ સર્વે જોડો',
      'Connect': 'જોડો',
      'Reply': 'જવાબ આપો',
      'Anything else? (optional)': 'બીજું કંઈ? (વૈકલ્પિક)',
      'Send': 'મોકલો',
      'Are you sure?': 'શું તમે ખાતરી કરો છો?',
      'Yes, remove': 'હા, દૂર કરો',
      'Complete your health card': 'તમારું હેલ્થ કાર્ડ પૂર્ણ કરો',
      'Complete': 'પૂર્ણ કરો',
      "You're all caught up.": 'તમારું બધું અપડેટ છે.',
      'Nothing needs your attention right now.': 'હાલમાં તમારા ધ્યાનની કોઈ જરૂર નથી.',
      'Hospital details are not available.': 'હોસ્પિટલની વિગતો ઉપલબ્ધ નથી.',
      'No requests yet. Use the form to ask the hospital to call you.': 'હજુ કોઈ વિનંતી નથી. હોસ્પિટલને કોલ કરવા કહેવા માટે ફોર્મ વાપરો.',
      'No camps for you right now.': 'હાલમાં તમારા માટે કોઈ કેમ્પ નથી.',
      "We'll let you know when a camp matches your health record.": 'તમારા હેલ્થ રેકોર્ડ સાથે કેમ્પ મેળ ખાશે ત્યારે અમે જાણ કરીશું.',
      'No upcoming camps.': 'કોઈ આગામી કેમ્પ નથી.',
      'You only get alerts that match your health.': 'તમને તમારા આરોગ્ય સાથે મેળ ખાતા એલર્ટ જ મળશે.',
      'No past camps yet.': 'હજુ કોઈ જૂનો કેમ્પ નથી.',
      'No medicines recorded.': 'કોઈ દવા નોંધાઈ નથી.',
      'No long-term conditions recorded.': 'કોઈ લાંબા ગાળાની સ્થિતિ નોંધાઈ નથી.',
      'No allergies recorded.': 'કોઈ એલર્જી નોંધાઈ નથી.',
      'No visits recorded yet.': 'હજુ કોઈ મુલાકાત નોંધાઈ નથી.',
      'Health survey': 'હેલ્થ સર્વે',
      'Connect survey': 'સર્વે જોડો',
      'Call helpdesk': 'હેલ્પડેસ્કને કોલ કરો',
      'Call': 'કોલ કરો',
      'No phone': 'ફોન નથી',
      'Request call': 'કોલ વિનંતી',
      'Yes': 'હા',
      'No': 'ના',
      'Not yet': 'હજુ નહીં',
      'Other reply': 'બીજો જવાબ',
      "I'll come": 'હું આવીશ',
      'Need help to come': 'આવવા માટે મદદ જોઈએ',
      "Can't come": 'આવી શકતો/શકતી નથી',
      'Add to calendar': 'કેલેન્ડરમાં ઉમેરો',
      'Edit': 'સંપાદિત કરો',
      'Edit my details': 'મારી વિગતો સંપાદિત કરો',
      'Call hospital': 'હોસ્પિટલને કોલ કરો',
      'Remove': 'દૂર કરો',
      'View only': 'માત્ર જુઓ',
      'You manage this family': 'તમે આ પરિવાર સંભાળો છો'
    },
    phrase: {
      'Good morning': 'સુપ્રભાત',
      'Good afternoon': 'નમસ્તે',
      'Good evening': 'શુભ સાંજ',
      'Patient': 'દર્દી',
      'Head of family': 'પરિવારના વડા',
      'Family member': 'પરિવાર સભ્ય',
      'Date to be announced': 'તારીખ જાહેર થવાની છે',
      'Venue to be announced': 'સ્થળ જાહેર થવાનું છે',
      'Today': 'આજે',
      'Tomorrow': 'કાલે',
      'day ago': 'દિવસ પહેલા',
      'days ago': 'દિવસ પહેલા',
      'In ': '',
      ' days': ' દિવસમાં',
      ' yrs': ' વર્ષ',
      ' yr': ' વર્ષ',
      'Age not set': 'ઉંમર સેટ નથી',
      'Under 1 yr': '1 વર્ષથી ઓછું',
      'Member': 'સભ્ય',
      'members': 'સભ્યો',
      'member': 'સભ્ય',
      'Health (read-only)': 'આરોગ્ય (માત્ર વાંચવા માટે)',
      'No readings yet': 'હજુ કોઈ રીડિંગ નથી',
      'Has own account': 'પોતાનું એકાઉન્ટ છે',
      'From health survey': 'હેલ્થ સર્વેથી',
      'Added by family': 'પરિવાર દ્વારા ઉમેર્યું',
      'Updated by you': 'તમારા દ્વારા અપડેટ',
      'You are head of family': 'તમે પરિવારના વડા છો',
      'Health readings and diagnoses come from the hospital and health survey team, so they can\'t be edited here.': 'આરોગ્ય રીડિંગ અને નિદાન હોસ્પિટલ અને હેલ્થ સર્વે ટીમ પાસેથી આવે છે, તેથી અહીં સંપાદિત કરી શકાતા નથી.',
      'Call me back': 'મને પાછો કોલ કરો',
      'Book appointment': 'અપોઇન્ટમેન્ટ બુક કરો',
      'Doctor consultation': 'ડોક્ટર સલાહ',
      'Test report': 'ટેસ્ટ રિપોર્ટ',
      'Medicine query': 'દવા વિશે પ્રશ્ન',
      'New symptom': 'નવું લક્ષણ',
      'Follow-up visit': 'ફોલો-અપ મુલાકાત',
      'General Medicine': 'જનરલ મેડિસિન',
      'Cardiology': 'કાર્ડિયોલોજી',
      'Orthopedics': 'ઓર્થોપેડિક્સ',
      'Gynecology': 'ગાયનેકોલોજી',
      'Pediatrics': 'પીડિયાટ્રિક્સ',
      'Dermatology': 'ડર્મેટોલોજી',
      'ENT': 'ENT',
      'Ophthalmology': 'આંખ વિભાગ',
      'Dental': 'દાંત વિભાગ',
      'Emergency': 'ઇમરજન્સી',
      'Sent': 'મોકલ્યું',
      'Seen by hospital': 'હોસ્પિટલે જોયું',
      'Appointment set': 'અપોઇન્ટમેન્ટ નક્કી',
      'Done': 'પૂર્ણ',
      'Cancelled': 'રદ',
      'open': 'બાકી',
      'Best time:': 'સારો સમય:',
      'Appointment:': 'અપોઇન્ટમેન્ટ:',
      'Hospital appointment:': 'હોસ્પિટલ અપોઇન્ટમેન્ટ:',
      'Did the hospital sort this out?': 'શું હોસ્પિટલએ આ ઉકેલી દીધું?',
      'You confirmed this was resolved.': 'તમે પુષ્ટિ કરી કે આ ઉકેલાયું છે.',
      "You said this wasn't resolved, so it's open again.": 'તમે કહ્યું કે આ ઉકેલાયું નથી, તેથી ફરી ખુલ્લું છે.',
      'Cancel request': 'વિનંતી રદ કરો',
      'Attending': 'હાજરી આપશે',
      'Asked for help': 'મદદ માંગી',
      'Reply needed': 'જવાબ જરૂરી',
      'Will you attend?': 'શું તમે હાજરી આપશો?',
      'Why you got this:': 'તમને આ કેમ મળ્યું:',
      'your health record shows': 'તમારા હેલ્થ રેકોર્ડમાં દર્શાવે છે',
      'This camp is for people with this condition.': 'આ કેમ્પ આ સ્થિતિ ધરાવતા લોકો માટે છે.',
      'Where:': 'સ્થળ:',
      'Organised by:': 'આયોજક:',
      'Your note:': 'તમારી નોંધ:',
      'You confirmed the camp team called you.': 'તમે પુષ્ટિ કરી કે કેમ્પ ટીમે તમને કોલ કર્યો.',
      'You said you would attend': 'તમે હાજરી આપશો એવું કહ્યું',
      'No reply': 'જવાબ નથી',
      'BP': 'બીપી',
      'Sugar': 'શુગર',
      'BMI': 'BMI',
      'Hb': 'Hb',
      'Taking': 'લઈ રહ્યા છો',
      'Being monitored': 'નજર રાખવામાં આવી રહી છે',
      'Active': 'સક્રિય',
      'Reaction': 'પ્રતિક્રિયા',
      'Moderate': 'મધ્યમ',
      'Visit #': 'મુલાકાત #',
      'Next visit:': 'આગામી મુલાકાત:',
      'Routine check-up.': 'સામાન્ય ચેકઅપ.',
      'Copied ': 'કોપી થયું ',
      'Your card is updated': 'તમારું કાર્ડ અપડેટ થયું',
      'Family details saved': 'પરિવાર વિગતો સાચવી',
      'Request sent': 'વિનંતી મોકલાઈ',
      'Request cancelled': 'વિનંતી રદ થઈ',
      'Reply sent': 'જવાબ મોકલાયો',
      'Thanks for confirming!': 'પુષ્ટિ કરવા બદલ આભાર!',
      'Request re-opened. The hospital will follow up.': 'વિનંતી ફરી ખુલ્લી છે. હોસ્પિટલ ફોલો-અપ કરશે.',
      'Health survey connected': 'હેલ્થ સર્વે જોડાયો',
      'Saving...': 'સાચવી રહ્યું છે...',
      'Sending...': 'મોકલી રહ્યું છે...',
      'Connecting...': 'જોડી રહ્યું છે...'
    }
  };

  function preserveOuter(original, translated) {
    const start = original.match(/^\s*/)[0];
    const end = original.match(/\s*$/)[0];
    return start + translated + end;
  }
  function translateText(text) {
    if (currentLang !== 'gu' || !text || !text.trim()) return text;
    const trimmed = text.trim();
    if (GU.exact[trimmed]) return preserveOuter(text, GU.exact[trimmed]);
    let out = text;
    Object.entries(GU.phrase).sort((a, b) => b[0].length - a[0].length).forEach(([en, gu]) => {
      out = out.split(en).join(gu);
    });
    return out;
  }
  function applyLanguage(root = document.body) {
    if (!root || translating) return;
    translating = true;
    document.documentElement.lang = currentLang === 'gu' ? 'gu' : 'en';
    document.body.classList.toggle('lang-gu', currentLang === 'gu');
    const sel = $('patientLanguage');
    if (sel && sel.value !== currentLang) sel.value = currentLang;
    root.querySelectorAll('option').forEach((option) => {
      if (!option.hasAttribute('value')) option.setAttribute('value', option.textContent.trim());
    });
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const p = node.parentElement;
        if (!p || ['SCRIPT', 'STYLE', 'TEXTAREA'].includes(p.tagName)) return NodeFilter.FILTER_REJECT;
        return node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      if (!originalText.has(node)) originalText.set(node, node.nodeValue);
      const nextText = currentLang === 'gu' ? translateText(originalText.get(node)) : originalText.get(node);
      if (node.nodeValue !== nextText) node.nodeValue = nextText;
    });
    root.querySelectorAll('[placeholder],[title],[aria-label],[data-title]').forEach((el) => {
      ['placeholder', 'title', 'aria-label', 'data-title'].forEach((attr) => {
        if (!el.hasAttribute(attr)) return;
        let store = originalAttr.get(el);
        if (!store) { store = {}; originalAttr.set(el, store); }
        if (!store[attr]) store[attr] = el.getAttribute(attr);
        const nextAttr = currentLang === 'gu' ? translateText(store[attr]) : store[attr];
        if (el.getAttribute(attr) !== nextAttr) el.setAttribute(attr, nextAttr);
      });
    });
    translating = false;
  }
  function scheduleLanguageApply() {
    if (currentLang !== 'gu' || translating) return;
    clearTimeout(translateTimer);
    translateTimer = setTimeout(() => applyLanguage(), 40);
  }
  function setupLanguage() {
    try { currentLang = localStorage.getItem('medpulse_patient_lang') === 'gu' ? 'gu' : 'en'; } catch (e) { currentLang = 'en'; }
    applyLanguage();
    if (!languageObserver && window.MutationObserver) {
      languageObserver = new MutationObserver(scheduleLanguageApply);
      languageObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
  }
  function setPatientLanguage(lang) {
    currentLang = lang === 'gu' ? 'gu' : 'en';
    try { localStorage.setItem('medpulse_patient_lang', currentLang); } catch (e) { /* ignore */ }
    applyLanguage();
  }

  function parseDay(s) {
    if (!s) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(s);
    return isNaN(d) ? null : d;
  }
  function daysUntil(s) {
    const d = parseDay(s); if (!d) return null;
    const t = new Date(); t.setHours(0, 0, 0, 0);
    return Math.round((d - t) / 86400000);
  }
  const fmtDay = (s) => { const d = parseDay(s); return d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; };
  function fmtWhen(ts) {
    if (!ts) return '';
    const d = new Date(String(ts).replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(ts) ? '' : 'Z'));
    if (isNaN(d)) return ts;
    const diff = (Date.now() - d) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} d ago`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }
  function relDay(n) {
    if (n === null) return '';
    if (n === 0) return 'Today';
    if (n === 1) return 'Tomorrow';
    if (n > 1) return `In ${n} days`;
    return `${-n} day${n === -1 ? '' : 's'} ago`;
  }
  function isMobile(p) { const d = digits(p); return d.length === 10 && /^[6-9]/.test(d) || (d.length === 12 && d.startsWith('91')); }
  function waLink(phone, text) {
    let d = digits(phone); if (d.length === 10) d = '91' + d;
    return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
  }
  const todayIso = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      method: opts.method || 'GET',
      headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    let data = {}; try { data = await res.json(); } catch (e) { /* empty */ }
    if (res.status === 401) { logoutPatient(); throw new Error('Session expired'); }
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    return data;
  }

  function showToast(message, type = 'info', duration = 3400) {
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<span>${esc(translateText(message))}</span><button class="toast-close" aria-label="Dismiss">✕</button>`;
    t.querySelector('button').onclick = () => t.remove();
    $('toastContainer').appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 200); }, duration);
  }
  function busy(btn, on, label) {
    if (!btn) return;
    if (on) { btn.dataset.label = btn.textContent; btn.textContent = translateText(label || 'Saving...'); btn.disabled = true; }
    else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; }
  }

  /* ================= Sidebar, tabs, modals ================= */
  function toggleSidebar() {
    const sb = $('sidebar'), ov = $('sidebarOverlay');
    if (window.innerWidth <= 860) { const open = sb.classList.toggle('open'); ov && ov.classList.toggle('active', open); }
    else {
      const c = document.documentElement.classList.toggle('sidebar-collapsed');
      document.body.classList.toggle('sidebar-collapsed', c);
      try { localStorage.setItem('sidebar_collapsed', c ? '1' : '0'); } catch (e) { /* ignore */ }
    }
  }
  function closeSidebar() {
    if (window.innerWidth <= 860) { $('sidebar').classList.remove('open'); $('sidebarOverlay').classList.remove('active'); }
  }
  function showTab(tab, push = true) {
    if (!TABS.includes(tab)) tab = 'overview';
    document.querySelectorAll('.pt-tab').forEach((b) => { const on = b.dataset.tab === tab; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
    document.querySelectorAll('.sidebar-link[data-tab]').forEach((a) => a.classList.toggle('active', a.dataset.tab === tab));
    document.querySelectorAll('.pt-panel').forEach((p) => p.classList.toggle('active', p.id === `panel-${tab}`));
    if (push && location.hash !== `#${tab}`) history.replaceState(null, '', `#${tab}`);
    const activeTab = document.querySelector(`.pt-tab[data-tab="${tab}"]`);
    if (activeTab && activeTab.scrollIntoView) activeTab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    closeSidebar();
    if (tab === 'campaigns') markRead();
  }
  document.querySelector('.pt-tabs').addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = [...document.querySelectorAll('.pt-tab')];
    const current = tabs.indexOf(document.activeElement);
    if (current < 0) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
      : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    showTab(tabs[next].dataset.tab);
    tabs[next].focus({ preventScroll: true });
  });
  window.addEventListener('hashchange', () => showTab(location.hash.slice(1), false));
  document.querySelectorAll('.sidebar-link[data-tab]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); showTab(a.dataset.tab); }));

  function logoutPatient() {
    if (window.MedPulseAuth && window.MedPulseAuth.logoutPatient) return window.MedPulseAuth.logoutPatient();
    try { localStorage.removeItem('medpulse_patient'); } catch (e) { /* ignore */ }
    location.href = '/login.html?patient=1';
  }
  const MODALS = ['memberModal', 'famModal', 'linkModal', 'rsvpModal', 'confirmModal'];
  function openModal(id) { $(id).style.display = 'flex'; applyLanguage($(id)); }
  function closeModal(id) { $(id).style.display = 'none'; }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') MODALS.forEach(closeModal); });
  function confirmDialog(title, text, okLabel) {
    return new Promise((resolve) => {
      $('confirmTitle').textContent = title; $('confirmText').textContent = text; $('confirmOk').textContent = okLabel || 'Yes';
      $('confirmOk').onclick = () => { closeModal('confirmModal'); resolve(true); };
      openModal('confirmModal');
      const obs = setInterval(() => { if ($('confirmModal').style.display === 'none') { clearInterval(obs); resolve(false); } }, 250);
    });
  }

  /* ================= Data loading ================= */
  async function loadAll() {
    const [card, rec, fam, notif, hosp, reqs] = await Promise.allSettled([
      api('/api/patient/card'), api('/api/patient/records'), api('/api/patient/family'),
      api('/api/patient/notifications'), api('/api/patient/hospital'), api('/api/patient/hospital-requests')
    ]);
    if (card.status === 'fulfilled') state.card = card.value.card; else showToast(card.reason.message, 'error');
    if (rec.status === 'fulfilled') state.records = rec.value;
    if (fam.status === 'fulfilled') state.family = fam.value;
    state.notifs = notif.status === 'fulfilled' ? (notif.value.notifications || []) : [];
    if (hosp.status === 'fulfilled') { state.hospital = hosp.value.hospital; state.departments = hosp.value.departments || []; state.reasons = hosp.value.reasons || []; }
    state.requests = reqs.status === 'fulfilled' ? (reqs.value.requests || []) : [];
    renderAll();
  }
  async function refresh(which) {
    const jobs = {
      card: () => api('/api/patient/card').then((d) => { state.card = d.card; }),
      family: () => api('/api/patient/family').then((d) => { state.family = d; }),
      notifs: () => api('/api/patient/notifications').then((d) => { state.notifs = d.notifications || []; }),
      requests: () => api('/api/patient/hospital-requests').then((d) => { state.requests = d.requests || []; }),
      records: () => api('/api/patient/records').then((d) => { state.records = d; })
    };
    await Promise.allSettled(which.map((k) => jobs[k]()));
    renderAll();
  }
  let readSent = false;
  function markRead() {
    if (readSent || !state.notifs.some((n) => n.notification_status === 'Delivered')) return;
    readSent = true;
    api('/api/patient/notifications/mark-read', { method: 'POST' }).catch(() => { readSent = false; });
  }

  function renderAll() {
    renderHero(); renderCard(); fillProfileForm(); renderFamily(); renderHospital(); renderRequests();
    renderVitals(); renderCampaigns(); renderRecords(); renderOverview(); renderActionCentre();
    applyLanguage();
    if ($('panel-campaigns').classList.contains('active')) markRead();
  }

  /* ================= Hero ================= */
  function renderHero() {
    const c = state.card || {};
    const h = new Date().getHours();
    $('heroGreeting').textContent = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    $('heroName').textContent = c.name || 'Patient';
    $('heroAvatar').textContent = initials(c.name);
    $('heroUid').textContent = c.patient_uid || 'PAT-····';
    $('heroAgeGender').textContent = [c.age_years ? `${c.age_years} yrs` : null, genderLabel(c.gender), c.blood_group && c.blood_group !== 'Unknown' ? `🩸 ${c.blood_group}` : null].filter(Boolean).join(' · ') || '—';
    $('heroRole').textContent = c.family_role === 'Head' ? '👑 Head of family' : '👪 Family member';
  }

  /* ================= Health card ================= */
  function cardCompleteness(c) {
    const items = [
      ['Date of birth', !!c.date_of_birth], ['Blood group', !!c.blood_group && c.blood_group !== 'Unknown'],
      ['Address', !!(c.address || c.family_address)], ['Emergency contact', !!(c.emergency_contact_name && c.emergency_contact_phone)]
    ];
    const missing = items.filter((i) => !i[1]).map((i) => i[0]);
    return { pct: Math.round(((items.length - missing.length) / items.length) * 100), missing };
  }
  function renderCard() {
    const c = state.card; if (!c) return;
    let qr = '';
    try { qr = window.MedPulseQR ? window.MedPulseQR.svg(`MEDPULSE:${c.patient_uid}`, { margin: 1, dark: '#0c4a6e' }) : ''; } catch (e) { qr = ''; }
    const address = c.address || [c.family_address, c.village, c.city].filter(Boolean).join(', ');
    const ec = c.emergency_contact_name ? `${c.emergency_contact_name}${c.emergency_contact_relation ? ` (${c.emergency_contact_relation})` : ''} · ${c.emergency_contact_phone || ''}` : 'Not added';
    $('healthCard').innerHTML = `
      <div class="hc-top">
        <div class="hc-brand"><div class="lg"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></div><div>MedPulse<small>PATIENT HEALTH CARD</small></div></div>
        <div class="hc-blood" title="Blood group"><b>${esc(c.blood_group && c.blood_group !== 'Unknown' ? c.blood_group : '—')}</b><span>BLOOD</span></div>
      </div>
      <div class="hc-mid">
        <div class="hc-av">${esc(initials(c.name))}</div>
        <div style="min-width:0"><div class="hc-name">${esc(c.name)}</div><div class="hc-uid">${esc(c.patient_uid)}</div></div>
      </div>
      <div class="hc-body">
        <div class="hc-fields">
          <div class="hc-f"><span>Age / Sex</span><b>${esc([c.age_years ? `${c.age_years} yrs` : '—', genderLabel(c.gender)].filter(Boolean).join(' · '))}</b></div>
          <div class="hc-f"><span>Date of birth</span><b>${esc(fmtDay(c.date_of_birth) || '—')}</b></div>
          <div class="hc-f"><span>Mobile</span><b>${esc(c.phone || '—')}</b></div>
          <div class="hc-f"><span>Family</span><b>${esc(c.family_code || '—')}</b></div>
          <div class="hc-f wide"><span>Emergency contact</span><b>${esc(ec)}</b></div>
          ${address ? `<div class="hc-f wide"><span>Address</span><b>${esc(address)}</b></div>` : ''}
        </div>
        ${qr ? `<div class="hc-qr" title="Scan at the hospital desk">${qr}</div>` : ''}
      </div>
      <div class="hc-foot"><span>🏥 ${esc(c.hospital_name || 'MedPulse Network')}</span><span>Issued ${esc(fmtDay((c.created_at || '').slice(0, 10)) || '')}</span></div>`;

    const comp = cardCompleteness(c);
    $('completeness').innerHTML = comp.missing.length ? `
      <div class="pt-complete"><strong>Your card is ${comp.pct}% complete.</strong> Add ${esc(comp.missing.join(', ').toLowerCase())} so the hospital can help you faster in an emergency.
        <div class="pt-meter"><i style="width:${comp.pct}%"></i></div></div>` : '';
    $('cntProfile').textContent = comp.missing.length ? '!' : '';
  }
  function printCard() {
    document.body.classList.add('print-card');
    const done = () => { document.body.classList.remove('print-card'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
    setTimeout(done, 1500);
  }
  function copyUid() {
    const uid = state.card && state.card.patient_uid; if (!uid) return;
    (navigator.clipboard ? navigator.clipboard.writeText(uid) : Promise.reject())
      .then(() => showToast(`Copied ${uid}`, 'success'))
      .catch(() => showToast(uid, 'info'));
  }

  /* ================= Profile form ================= */
  let profileFilled = false;
  function fillProfileForm(force) {
    const c = state.card; if (!c || (profileFilled && !force)) return;
    profileFilled = true;
    $('pfName').value = c.name || '';
    $('pfDob').value = c.date_of_birth || '';
    $('pfDob').max = todayIso();
    $('pfGender').value = ['M', 'F'].includes(c.gender) ? c.gender : (c.gender === 'Male' ? 'M' : c.gender === 'Female' ? 'F' : 'Other');
    $('pfPhone').value = c.phone || '';
    $('pfEmail').value = c.email || '';
    $('pfAddress').value = c.address || '';
    $('pfEcName').value = c.emergency_contact_name || '';
    $('pfEcRel').value = c.emergency_contact_relation || '';
    $('pfEcPhone').value = c.emergency_contact_phone || '';
    $('pfBlood').innerHTML = BLOOD.map((b) => `<label><input type="radio" name="pfBlood" value="${b}" ${c.blood_group === b ? 'checked' : ''}><span>${b === 'Unknown' ? "Don't know" : b}</span></label>`).join('');
  }
  function fieldErr(id, show) { $(id).style.display = show ? 'block' : 'none'; }
  async function saveProfile() {
    const name = $('pfName').value.trim();
    const dob = $('pfDob').value;
    const email = $('pfEmail').value.trim();
    const ecPhone = digits($('pfEcPhone').value);
    let ok = true;
    fieldErr('pfNameErr', !name); ok = ok && !!name;
    const badDob = dob && dob > todayIso(); fieldErr('pfDobErr', badDob); ok = ok && !badDob;
    const badEmail = email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); fieldErr('pfEmailErr', badEmail); ok = ok && !badEmail;
    const badEc = ecPhone && (ecPhone.length !== 10 || ecPhone === digits(state.card.phone)); fieldErr('pfEcPhoneErr', badEc); ok = ok && !badEc;
    if (!ok) return;
    const blood = document.querySelector('input[name="pfBlood"]:checked');
    const btn = $('pfSave'); busy(btn, true);
    try {
      const d = await api('/api/patient/profile', { method: 'PUT', body: {
        name, date_of_birth: dob || null, gender: $('pfGender').value, email: email || null, address: $('pfAddress').value.trim() || null,
        blood_group: blood ? blood.value : null, emergency_contact_name: $('pfEcName').value.trim() || null,
        emergency_contact_relation: $('pfEcRel').value || null, emergency_contact_phone: ecPhone || null
      } });
      state.card = d.card; fillProfileForm(true);
      showToast('Your card is updated', 'success');
      await refresh(['family']);
    } catch (e) { showToast(e.message, 'error'); }
    finally { busy(btn, false); }
  }

  /* ================= Family ================= */
  function healthPills(m) {
    const out = [];
    if (m.sbp && m.dbp) out.push(`<span class="pt-pill ${(m.sbp >= 140 || m.dbp >= 90) ? 'bad' : 'mute'}">BP ${esc(m.sbp)}/${esc(m.dbp)}</span>`);
    if (m.rbs) out.push(`<span class="pt-pill ${m.rbs >= 200 ? 'bad' : m.rbs >= 140 ? 'warn' : 'mute'}">Sugar ${esc(m.rbs)}</span>`);
    if (m.hb) out.push(`<span class="pt-pill ${m.hb < 11 ? 'warn' : 'mute'}">Hb ${esc(m.hb)}</span>`);
    if (m.bmi) out.push(`<span class="pt-pill mute">BMI ${esc(Number(m.bmi).toFixed(1))}</span>`);
    if (m.conditions) m.conditions.split(', ').slice(0, 3).forEach((c) => out.push(`<span class="pt-pill warn">${esc(c)}</span>`));
    return out.join('');
  }
  function ageText(m) {
    if (m.age_years > 0) return `${m.age_years} yrs`;
    if (m.age_months > 0) return `${m.age_months} mo`;
    return m.date_of_birth ? 'Under 1 yr' : 'Age not set';
  }
  function renderFamily() {
    const F = state.family; if (!F || !F.family) return;
    const f = F.family, canEdit = F.can_edit;
    const addr = [f.address, f.village, f.city, f.district, f.pincode].filter(Boolean).join(', ');
    $('famHead').innerHTML = `
      <div style="min-width:0">
        <h2 class="fam-title">👪 ${esc(f.family_name || `${f.head_of_family}'s family`)}</h2>
        <div class="fam-meta">${esc(f.family_code || '')}${addr ? ` · 📍 ${esc(addr)}` : ''}</div>
        <div class="fam-stats">
          <span class="pt-pill info">${F.members.length} member${F.members.length === 1 ? '' : 's'}</span>
          <span class="pt-pill ${canEdit ? 'ok' : 'mute'}">${canEdit ? '👑 You are head of family' : '👁️ View only'}</span>
          ${f.student_name ? `<span class="pt-pill mute">📝 Health survey: ${esc(f.student_name)}</span>` : ''}
        </div>
      </div>
      ${canEdit ? `<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="pt-btn" onclick="PT.editFamily()">🏠 Edit address</button><button class="pt-btn primary" onclick="PT.addMember()">＋ Add member</button></div>` : ''}`;

    $('famNotice').innerHTML = canEdit
      ? `<div class="pt-note"><span>ℹ️</span><div>You can add family members and update their basic details. Health readings and diagnoses come from the hospital and health survey team, so they can't be edited here.</div></div>`
      : `<div class="pt-note"><span>👁️</span><div>Only <strong>${esc(f.head_of_family)}</strong> (head of family) can make changes. You can view your family here.</div></div>`;

    const cards = F.members.map((m) => {
      const tags = [
        m.is_self ? '<span class="pt-pill info">You</span>' : '',
        m.relation_to_hof === 'Head' && !m.is_self ? '<span class="pt-pill ok">👑 Head</span>' : '',
        m.account_uid && !m.is_self ? '<span class="pt-pill mute">📱 Has own account</span>' : '',
        m.surveyed ? '<span class="pt-pill mute">📝 From health survey</span>' : '<span class="pt-pill mute">✍️ Added by family</span>',
        m.patient_updated_at && m.surveyed && !m.is_self ? '<span class="pt-pill warn">Updated by you</span>' : ''
      ].join('');
      const health = healthPills(m);
      return `
        <article class="mem ${m.is_self ? 'self' : ''}">
          <div class="mem-top">
            <div class="mem-av" style="background:${avColor(m.name)}">${esc(initials(m.name))}</div>
            <div style="min-width:0">
              <div class="mem-name">${esc(m.name)}</div>
              <div class="mem-sub">${esc(m.is_self ? 'You' : (m.relation_to_hof || 'Member'))} · ${esc(ageText(m))}${m.gender ? ` · ${esc(genderLabel(m.gender))}` : ''}</div>
              ${m.contact_number ? `<div class="mem-sub">📞 ${esc(m.contact_number)}</div>` : ''}
              ${m.occupation || m.education ? `<div class="mem-sub">${esc([m.occupation, m.education].filter(Boolean).join(' · '))}</div>` : ''}
            </div>
          </div>
          <div class="mem-tags">${tags}</div>
          <div class="mem-health"><span class="lbl">Health (read-only)</span>${health || '<span class="pt-sub">No readings yet</span>'}</div>
          <div class="mem-actions">
            ${m.is_self ? `<button class="pt-btn sm" onclick="showTab('profile')">✏️ Edit my details</button>` : ''}
            ${m.can_edit ? `<button class="pt-btn sm" onclick="PT.editMember(${m.id})">✏️ Edit</button>` : ''}
            ${(canEdit || m.is_self) ? `<button class="pt-btn sm" onclick="PT.requestFor(${m.id})">📞 Call hospital</button>` : ''}
            ${m.can_delete ? `<button class="pt-btn sm ghost-danger icon" onclick="PT.removeMember(${m.id})" aria-label="Remove ${esc(m.name)}" title="Remove">🗑️</button>` : ''}
          </div>
        </article>`;
    });
    if (canEdit) cards.push(`<button type="button" class="mem-add" onclick="PT.addMember()"><span class="plus">＋</span>Add family member</button>`);
    $('famGrid').innerHTML = cards.join('');
  }

  let editingMemberId = null;
  function fillRelations(sel) {
    const rels = ((state.family && state.family.relations) || []).filter((r) => r !== 'Head');
    $('mfRel').innerHTML = '<option value="">Select</option>' + rels.map((r) => `<option ${r === sel ? 'selected' : ''}>${esc(r)}</option>`).join('');
  }
  function addMember() {
    editingMemberId = null;
    $('memberTitle').textContent = '＋ Add family member';
    ['mfName', 'mfDob', 'mfAge', 'mfPhone', 'mfOcc', 'mfEdu'].forEach((id) => { $(id).value = ''; });
    $('mfGender').value = ''; $('mfMarital').value = 'Unknown'; $('mfDob').max = todayIso();
    fillRelations(''); $('mfErr').style.display = 'none';
    openModal('memberModal'); setTimeout(() => $('mfName').focus(), 60);
  }
  function editMember(id) {
    const m = state.family.members.find((x) => x.id === id); if (!m) return;
    editingMemberId = id;
    $('memberTitle').textContent = `✏️ Edit ${m.name}`;
    $('mfName').value = m.name || ''; $('mfDob').value = m.date_of_birth || ''; $('mfDob').max = todayIso();
    $('mfAge').value = m.date_of_birth ? '' : (m.age_years || '');
    $('mfPhone').value = m.contact_number || ''; $('mfOcc').value = m.occupation || ''; $('mfEdu').value = m.education || '';
    $('mfGender').value = m.gender || ''; $('mfMarital').value = m.marital_status || 'Unknown';
    fillRelations(m.relation_to_hof); $('mfErr').style.display = 'none';
    openModal('memberModal');
  }
  async function saveMember() {
    const err = (msg) => { $('mfErr').textContent = msg; $('mfErr').style.display = 'block'; };
    const body = {
      name: $('mfName').value.trim(), relation_to_hof: $('mfRel').value, gender: $('mfGender').value,
      date_of_birth: $('mfDob').value || null, contact_number: digits($('mfPhone').value) || null,
      marital_status: $('mfMarital').value, occupation: $('mfOcc').value.trim() || null, education: $('mfEdu').value.trim() || null
    };
    if ($('mfAge').value !== '' && !body.date_of_birth) body.age_years = $('mfAge').value;
    if (!body.name) return err('Please enter a name.');
    if (!body.relation_to_hof) return err('Please choose a relation.');
    if (!body.gender) return err('Please choose a gender.');
    if (!body.date_of_birth && body.age_years === undefined && !editingMemberId) return err('Enter a date of birth or an age.');
    if (body.contact_number && body.contact_number.length !== 10) return err('Mobile must be 10 digits.');
    const btn = $('mfSave'); busy(btn, true);
    try {
      const url = editingMemberId ? `/api/patient/family/members/${editingMemberId}` : '/api/patient/family/members';
      const d = await api(url, { method: editingMemberId ? 'PUT' : 'POST', body });
      state.family = d; closeModal('memberModal');
      showToast(editingMemberId ? 'Member updated' : `${body.name} added to your family`, 'success');
      renderAll();
    } catch (e) { err(e.message); }
    finally { busy(btn, false); }
  }
  async function removeMember(id) {
    const m = state.family.members.find((x) => x.id === id); if (!m) return;
    const yes = await confirmDialog(`Remove ${m.name}?`, 'They will be removed from your family list. This cannot be undone.', 'Yes, remove');
    if (!yes) return;
    try { state.family = await api(`/api/patient/family/members/${id}`, { method: 'DELETE' }); showToast(`${m.name} removed`, 'info'); renderAll(); }
    catch (e) { showToast(e.message, 'error'); }
  }
  function editFamily() {
    const f = state.family.family;
    $('ffName').value = f.family_name || ''; $('ffAddr').value = f.address || ''; $('ffVillage').value = f.village || '';
    $('ffCity').value = f.city || ''; $('ffDistrict').value = f.district || ''; $('ffPin').value = f.pincode || '';
    openModal('famModal');
  }
  async function saveFamily() {
    const pin = digits($('ffPin').value);
    if (pin && pin.length !== 6) return showToast('PIN code must be 6 digits', 'error');
    const btn = $('ffSave'); busy(btn, true);
    try {
      state.family = await api('/api/patient/family', { method: 'PUT', body: {
        family_name: $('ffName').value.trim(), address: $('ffAddr').value.trim(), village: $('ffVillage').value.trim(),
        city: $('ffCity').value.trim(), district: $('ffDistrict').value.trim(), pincode: pin || null
      } });
      closeModal('famModal'); showToast('Family details saved', 'success');
      await refresh(['card']);
    } catch (e) { showToast(e.message, 'error'); }
    finally { busy(btn, false); }
  }

  /* ================= Hospital ================= */
  function hospitalButtons(h, compact) {
    const phone = digits(h && h.contact_phone);
    return `
      <div class="hosp-call">
        ${phone ? `<a class="pt-btn call" href="tel:${esc(phone)}">📞 Call${compact ? '' : ' helpdesk'}</a>` : '<button class="pt-btn" disabled>📞 No phone</button>'}
        ${isMobile(phone) ? `<a class="pt-btn wa" href="${esc(waLink(phone, `Hello, I am ${state.card ? state.card.name : ''} (${state.card ? state.card.patient_uid : ''}).`))}" target="_blank" rel="noopener">💬 WhatsApp</a>`
          : `<button class="pt-btn primary" onclick="showTab('hospital'); setTimeout(() => document.getElementById('reqMsg').focus(), 60)">✉️ Request call</button>`}
      </div>`;
  }
  function renderHospital() {
    const h = state.hospital;
    const body = h ? `
      <div class="hosp-card">
        <div class="ic">🏥</div>
        <div style="min-width:0">
          <div class="hosp-name">${esc(h.name)}</div>
          <div class="pt-sub">${esc([h.type, h.city].filter(Boolean).join(' · '))}</div>
          ${h.contact_phone ? `<div class="pt-sub">📞 ${esc(h.contact_phone)}</div>` : ''}
        </div>
      </div>
      ${hospitalButtons(h)}` : '<div class="pt-empty">Hospital details are not available.</div>';
    $('hospitalBody').innerHTML = body;
    $('overviewHospital').innerHTML = h ? `
      <div class="hosp-card"><div class="ic">🏥</div><div style="min-width:0"><div class="hosp-name">${esc(h.name)}</div><div class="pt-sub">${esc(h.city || '')}${h.contact_phone ? ` · 📞 ${esc(h.contact_phone)}` : ''}</div></div></div>
      ${hospitalButtons(h, true)}` : '<div class="pt-empty">Hospital details are not available.</div>';

    // request form options
    const F = state.family;
    const members = F ? F.members.filter((m) => m.is_self || F.can_edit) : [];
    const sel = $('reqFor').value;
    $('reqFor').innerHTML = members.map((m) => `<option value="${m.id}">${esc(m.is_self ? `Me (${m.name})` : `${m.name} (${m.relation_to_hof || 'Member'})`)}</option>`).join('') || '<option value="">Me</option>';
    if (sel && members.some((m) => String(m.id) === sel)) $('reqFor').value = sel;
    if (!$('reqDept').options.length) $('reqDept').innerHTML = state.departments.map((d) => `<option>${esc(d)}</option>`).join('');
    if (!$('reqReason').options.length) $('reqReason').innerHTML = state.reasons.map((d) => `<option>${esc(d)}</option>`).join('');
  }
  function requestFor(memberId) {
    showTab('hospital');
    $('reqFor').value = String(memberId);
    setTimeout(() => $('reqDept').focus(), 60);
  }

  const REQ_PILL = { Open: 'warn', Acknowledged: 'info', Scheduled: 'info', Resolved: 'ok', Cancelled: 'mute' };
  const REQ_LABEL = { Open: 'Sent', Acknowledged: 'Seen by hospital', Scheduled: 'Appointment set', Resolved: 'Done', Cancelled: 'Cancelled' };
  function renderRequests() {
    const reqs = state.requests;
    const openN = reqs.filter((r) => ['Open', 'Acknowledged', 'Scheduled'].includes(r.status)).length;
    $('reqCountPill').textContent = `${openN} open`;
    $('requestList').innerHTML = reqs.length ? reqs.map((r) => {
      const steps = ['Open', 'Acknowledged', 'Scheduled', 'Resolved'];
      const idx = steps.indexOf(r.status);
      const forWho = r.for_member_name && r.for_member_name !== (state.card && state.card.name) ? ` · for ${esc(r.for_member_name)}` : '';
      return `
      <div class="pt-req">
        <div class="row">
          <div class="t">${r.channel === 'WhatsApp' ? '💬' : '📞'} ${esc(r.reason)} · ${esc(r.department)}</div>
          <span class="pt-pill ${REQ_PILL[r.status]}">${esc(REQ_LABEL[r.status] || r.status)}</span>
        </div>
        <div class="d">${esc(fmtWhen(r.created_at))}${forWho}${r.preferred_time ? ` · Best time: ${esc(r.preferred_time)}` : ''}</div>
        ${r.message ? `<div class="msg">${esc(r.message)}</div>` : ''}
        ${r.status !== 'Cancelled' ? `<div class="pt-steps">${steps.map((s, i) => `<span class="s ${i <= idx ? 'on' : ''}">${REQ_LABEL[s]}</span>`).join('<span>›</span>')}</div>` : ''}
        ${r.scheduled_for && r.status !== 'Cancelled' ? `<div class="pt-appt">📅 Appointment: ${esc(r.scheduled_for)}</div>` : ''}
        ${r.hospital_note ? `<div class="reply">🏥 <strong>${esc(r.handled_by_name || 'Hospital')}:</strong> ${esc(r.hospital_note)}</div>` : ''}
        ${r.patient_confirmation === 'Disputed' ? `<div class="pt-rsvp-note" style="color:#b91c1c">You said this wasn't resolved, so it's open again.</div>` : ''}
        ${r.status === 'Resolved' && !r.patient_confirmation ? `
          <div class="pt-confirm"><div class="grow">Did the hospital sort this out?</div>
            <button class="pt-btn sm" onclick="PT.confirmRequest(${r.id}, true)">👍 Yes</button>
            <button class="pt-btn sm ghost-danger" onclick="PT.confirmRequest(${r.id}, false)">Not yet</button></div>` : ''}
        ${r.status === 'Resolved' && r.patient_confirmation === 'Confirmed' ? `<div class="pt-rsvp-note" style="color:#065f46">✔ You confirmed this was resolved.</div>` : ''}
        ${['Open', 'Acknowledged', 'Scheduled'].includes(r.status) ? `<div style="text-align:right;margin-top:8px"><button class="pt-btn sm ghost-danger" onclick="PT.cancelRequest(${r.id})">Cancel request</button></div>` : ''}
      </div>`;
    }).join('') : `<div class="pt-empty" style="padding:16px">No requests yet. Use the form to ask the hospital to call you.</div>`;
    const toConfirm = reqs.filter((r) => r.status === 'Resolved' && !r.patient_confirmation).length;
    $('cntHospital').textContent = toConfirm || '';
  }
  async function submitRequest() {
    const btn = $('reqSubmit'); busy(btn, true, 'Sending…');
    try {
      const body = {
        for_member_id: $('reqFor').value ? Number($('reqFor').value) : undefined,
        channel: document.querySelector('input[name="channel"]:checked').value,
        department: $('reqDept').value, reason: $('reqReason').value, preferred_time: $('reqTime').value, message: $('reqMsg').value.trim()
      };
      const d = await api('/api/patient/hospital-requests', { method: 'POST', body });
      showToast(d.message || 'Request sent', 'success');
      $('reqMsg').value = '';
      await refresh(['requests']);
    } catch (e) { showToast(e.message, 'error'); }
    finally { busy(btn, false); }
  }
  async function cancelRequest(id) {
    const yes = await confirmDialog('Cancel this request?', 'The hospital will no longer call you about it.', 'Yes, cancel');
    if (!yes) return;
    try { await api(`/api/patient/hospital-requests/${id}/cancel`, { method: 'POST' }); showToast('Request cancelled', 'info'); await refresh(['requests']); }
    catch (e) { showToast(e.message, 'error'); }
  }
  async function confirmRequest(id, confirmed) {
    try {
      await api(`/api/patient/hospital-requests/${id}/confirm`, { method: 'POST', body: { confirmed } });
      showToast(confirmed ? 'Thanks for confirming!' : 'Request re-opened. The hospital will follow up.', confirmed ? 'success' : 'info');
      await refresh(['requests']);
    } catch (e) { showToast(e.message, 'error'); }
  }

  /* ================= Vitals (plain language) ================= */
  function latestVitals() {
    const r = state.records || {}; const m = r.member || {}; const fu = (r.follow_ups || [])[0] || {};
    const pick = (k) => (fu[k] !== null && fu[k] !== undefined && fu[k] !== '') ? fu[k] : (m[k] || null);
    return { sbp: pick('sbp'), dbp: pick('dbp'), rbs: pick('rbs'), hb: pick('hb'), bmi: m.bmi || null, date: fu.visit_date || null };
  }
  function renderVitals() {
    const v = latestVitals();
    $('vitalsSource').textContent = v.date ? `From your check-up on ${fmtDay(v.date)}.` : 'From your family health survey.';
    const cards = [];
    if (v.sbp && v.dbp) {
      const lvl = (v.sbp >= 140 || v.dbp >= 90) ? 'bad' : (v.sbp >= 130 || v.dbp >= 80) ? 'warn' : 'ok';
      cards.push({ lvl, lbl: 'Blood pressure', val: `${v.sbp}/${v.dbp}`, unit: 'mmHg', tag: { bad: 'High', warn: 'Slightly high', ok: 'Normal' }[lvl],
        hint: { bad: 'Higher than it should be. Take your medicines daily and talk to your doctor.', warn: 'A little above normal. Less salt and daily walking help.', ok: 'Good. Keep it up.' }[lvl] });
    } else cards.push({ lvl: '', lbl: 'Blood pressure', val: '—', unit: '', tag: 'Not checked', hint: 'Get it checked at your next visit.' });
    if (v.rbs) {
      const lvl = v.rbs >= 200 ? 'bad' : v.rbs >= 140 ? 'warn' : 'ok';
      cards.push({ lvl, lbl: 'Blood sugar', val: v.rbs, unit: 'mg/dL', tag: { bad: 'High', warn: 'Borderline', ok: 'Normal' }[lvl],
        hint: { bad: 'High sugar. Please see a doctor and avoid sweets and sugary drinks.', warn: 'Slightly high. Cut down on sweets and white rice.', ok: 'In the normal range.' }[lvl] });
    } else cards.push({ lvl: '', lbl: 'Blood sugar', val: '—', unit: '', tag: 'Not checked', hint: 'Not measured yet.' });
    if (v.hb) {
      const lvl = v.hb < 8 ? 'bad' : v.hb < 11 ? 'warn' : 'ok';
      cards.push({ lvl, lbl: 'Haemoglobin', val: v.hb, unit: 'g/dL', tag: { bad: 'Very low', warn: 'Low', ok: 'Good' }[lvl],
        hint: { bad: 'Very low blood. Please see a doctor soon.', warn: 'Low blood (anaemia). Eat green leafy vegetables, jaggery and dal; take iron tablets if prescribed.', ok: 'Healthy level.' }[lvl] });
    } else cards.push({ lvl: '', lbl: 'Haemoglobin', val: '—', unit: '', tag: 'Not checked', hint: 'Not measured yet.' });
    if (v.bmi) {
      const b = Number(v.bmi); const lvl = (b >= 30 || b < 16) ? 'bad' : (b >= 25 || b < 18.5) ? 'warn' : 'ok';
      const tag = b >= 30 ? 'Obese' : b >= 25 ? 'Overweight' : b < 18.5 ? 'Underweight' : 'Healthy';
      cards.push({ lvl, lbl: 'Body weight (BMI)', val: b.toFixed(1), unit: '', tag,
        hint: b >= 25 ? 'Above healthy weight. Walk 30 minutes a day and eat less oily food.' : b < 18.5 ? 'Below healthy weight. Eat regular, nutritious meals.' : 'Healthy weight for your height.' });
    } else cards.push({ lvl: '', lbl: 'Body weight (BMI)', val: '—', unit: '', tag: 'Not checked', hint: 'Not measured yet.' });
    const pill = { ok: 'ok', warn: 'warn', bad: 'bad', '': 'mute' };
    $('vitalsGrid').innerHTML = cards.map((c) => `
      <div class="pt-vital ${c.lvl}">
        <div class="lbl"><span>${esc(c.lbl)}</span><span class="pt-pill ${pill[c.lvl]}">${esc(c.tag)}</span></div>
        <div class="val">${esc(c.val)} <small>${esc(c.unit)}</small></div>
        <div class="hint">${esc(c.hint)}</div>
      </div>`).join('');
  }

  /* ================= Campaigns ================= */
  const RSVP_LABEL = { 'Attending': '✅ Attending', 'Not Attending': "❌ Can't attend", 'Need Help': '🙋 Asked for help', 'Pending': '⏳ Reply needed' };
  const RSVP_PILL = { 'Attending': 'ok', 'Not Attending': 'bad', 'Need Help': 'warn', 'Pending': 'info' };
  function rsvpOf(n) {
    if (n.rsvp && n.rsvp !== 'Pending') return n.rsvp;
    if (n.notification_status === 'Acknowledged') return 'Attending';
    if (n.notification_status === 'Declined') return 'Not Attending';
    return 'Pending';
  }
  const isPast = (n) => { const d = daysUntil(n.event_date); return (d !== null && d < 0) || n.campaign_status === 'Completed' || n.campaign_status === 'Cancelled'; };
  const needsContactConfirm = (n) => (n.contacted_at || ['Contacted', 'Assisted'].includes(n.cadet_call_status)) && !n.patient_contact_confirmation;

  function campaignCard(n) {
    const r = rsvpOf(n); const du = daysUntil(n.event_date);
    const sel = (v) => (r === v ? `sel-${v.replace(' ', '')}` : '');
    return `
    <article class="pt-camp" id="camp-${n.notification_id}">
      <div class="pt-camp-top">
        <div class="pt-camp-row">
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            <span class="pt-kw">🎯 ${esc(n.matched_keyword)}</span>
            ${n.notification_status === 'Delivered' ? '<span class="pt-pill info">New</span>' : ''}
          </div>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            <span class="pt-pill mute">📅 ${esc(fmtDay(n.event_date) || 'Date to be announced')}${du !== null && du >= 0 && du <= 7 ? ` · ${relDay(du)}` : ''}</span>
            <span class="pt-pill ${RSVP_PILL[r]}">${RSVP_LABEL[r]}</span>
          </div>
        </div>
        <h3>${esc(n.campaign_title)}</h3>
        ${n.campaign_description ? `<p class="desc">${esc(n.campaign_description)}</p>` : ''}
        <div class="pt-why"><span>🔎</span><div><strong>Why you got this:</strong> your health record shows <strong>${esc(n.matched_condition_detail || n.matched_keyword)}</strong>. This camp is for people with this condition.</div></div>
        <div class="pt-meta">
          <div>📍 <b>Where:</b> ${esc(n.venue || 'To be announced')}</div>
          <div>🎓 <b>Organised by:</b> ${esc(n.organizing_college || 'Medical College')}</div>
        </div>
      </div>
      <div class="pt-camp-foot">
        <div class="pt-rsvp-q">Will you attend?</div>
        <div class="pt-rsvp" role="group" aria-label="RSVP">
          <button class="${sel('Attending')}" onclick="PT.sendRsvp(${n.notification_id}, 'Attending')">✅ Yes, I'll come</button>
          <button class="${sel('Not Attending')}" onclick="PT.askRsvp(${n.notification_id}, 'Not Attending')">❌ Can't come</button>
          <button class="${sel('Need Help')}" onclick="PT.askRsvp(${n.notification_id}, 'Need Help')">🙋 Need help to come</button>
        </div>
        ${n.rsvp_note ? `<div class="pt-rsvp-note">Your note: “${esc(n.rsvp_note)}”</div>` : ''}
        ${needsContactConfirm(n) ? `
          <div class="pt-confirm">
            <span>📞</span><div class="grow">The camp team (${esc(firstName(n.cadet_name))}) says they called you about this. Did they?</div>
            <button class="pt-btn sm" onclick="PT.confirmCampContact(${n.notification_id}, true)">👍 Yes</button>
            <button class="pt-btn sm ghost-danger" onclick="PT.confirmCampContact(${n.notification_id}, false)">No</button>
          </div>` : ''}
        ${n.patient_contact_confirmation === 'Confirmed' ? `<div class="pt-rsvp-note" style="color:#065f46">✔ You confirmed the camp team called you.</div>` : ''}
        <div class="pt-foot-links">
          ${n.event_date ? `<button class="pt-btn sm" onclick="PT.downloadIcs(${n.notification_id})">🗓️ Add to calendar</button>` : ''}
        </div>
      </div>
    </article>`;
  }
  function renderCampaigns() {
    const up = state.notifs.filter((n) => !isPast(n)).sort((a, b) => (daysUntil(a.event_date) ?? 999) - (daysUntil(b.event_date) ?? 999));
    const past = state.notifs.filter(isPast);
    $('upcomingCamps').innerHTML = up.length ? up.map(campaignCard).join('') : `
      <div class="pt-empty"><span class="big">🛡️</span><strong>No camps for you right now.</strong><br>We'll let you know when a camp matches your health record.</div>`;
    $('pastCamps').innerHTML = past.length ? past.map((n) => {
      const r = rsvpOf(n);
      return `<div class="pt-past"><div><div class="t">${esc(n.campaign_title)}</div><div class="d">${esc(fmtDay(n.event_date))} · ${esc(n.venue || '')}</div></div>
        <span class="pt-pill ${r === 'Attending' ? 'ok' : 'mute'}">${r === 'Attending' ? '✅ You said you would attend' : r === 'Pending' ? 'No reply' : esc(RSVP_LABEL[r])}</span></div>`;
    }).join('') : `<div class="pt-sub">No past camps yet.</div>`;

    const soon = up.filter((n) => { const d = daysUntil(n.event_date); return d !== null && d >= 0 && d <= 1 && rsvpOf(n) !== 'Not Attending'; });
    const appts = state.requests.filter((r) => r.status === 'Scheduled' && r.scheduled_for);
    $('reminderArea').innerHTML = soon.map((n) => `
      <div class="pt-reminder">
        <div class="ic">⏰</div>
        <div class="grow"><div class="t">${relDay(daysUntil(n.event_date))}: ${esc(n.campaign_title)}</div><div class="d">📍 ${esc(n.venue || 'Venue to be announced')}${rsvpOf(n) === 'Pending' ? ' · Please reply so the team can plan.' : ''}</div></div>
        <button class="pt-btn sm" onclick="PT.openCamp(${n.notification_id})">Open</button>
      </div>`).join('') + appts.map((r) => `
      <div class="pt-reminder" style="background:linear-gradient(135deg,#eef2ff,#f5f3ff);border-color:#a5b4fc">
        <div class="ic">📅</div>
        <div class="grow"><div class="t" style="color:#3730a3">Hospital appointment: ${esc(r.scheduled_for)}</div><div class="d" style="color:#3730a3">${esc(r.department)}${r.for_member_name ? ` · for ${esc(r.for_member_name)}` : ''}</div></div>
        <button class="pt-btn sm" onclick="showTab('hospital')">Open</button>
      </div>`).join('');

    const next = up[0];
    $('nextCampBody').innerHTML = next ? `
      <div style="font-weight:800;color:var(--text-primary)">${esc(next.campaign_title)}</div>
      <div class="pt-sub" style="margin:4px 0 10px">📅 ${esc(fmtDay(next.event_date) || 'TBA')} · 📍 ${esc(next.venue || 'TBA')}</div>
      <span class="pt-pill ${RSVP_PILL[rsvpOf(next)]}">${RSVP_LABEL[rsvpOf(next)]}</span>` :
      `<div class="pt-empty" style="padding:16px"><strong>No upcoming camps.</strong><br>You only get alerts that match your health.</div>`;
    const pending = up.filter((n) => rsvpOf(n) === 'Pending').length + up.filter(needsContactConfirm).length;
    $('cntCampaigns').textContent = pending || '';
  }
  function openCamp(id) {
    showTab('campaigns');
    setTimeout(() => { const el = $(`camp-${id}`); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 80);
  }
  let rsvpCtx = null;
  const QUICK_NOTES = {
    'Not Attending': ['Out of town', 'Not feeling well', 'Work that day', 'Already see a doctor'],
    'Need Help': ['No transport', 'Need someone to come with me', "Don't know the place", 'Timing problem']
  };
  function askRsvp(id, rsvp) {
    rsvpCtx = { id, rsvp };
    $('rsvpTitle').textContent = rsvp === 'Need Help' ? '🙋 What help do you need?' : "❌ Can't attend";
    $('rsvpHelp').textContent = rsvp === 'Need Help' ? 'The camp team will call you to help you attend.' : 'Let the camp team know why (optional).';
    $('rsvpNote').value = '';
    $('rsvpQuick').innerHTML = QUICK_NOTES[rsvp].map((q) => `<label><input type="radio" name="rsvpQuick" value="${esc(q)}"><span>${esc(q)}</span></label>`).join('');
    openModal('rsvpModal');
  }
  function submitRsvpNote() {
    const quick = document.querySelector('input[name="rsvpQuick"]:checked');
    const note = [quick ? quick.value : '', $('rsvpNote').value.trim()].filter(Boolean).join('. ');
    closeModal('rsvpModal');
    sendRsvp(rsvpCtx.id, rsvpCtx.rsvp, note);
  }
  async function sendRsvp(id, rsvp, note) {
    try {
      const d = await api(`/api/patient/notifications/${id}/rsvp`, { method: 'POST', body: { rsvp, note } });
      showToast(d.message || 'Reply sent', 'success');
      await refresh(['notifs']);
    } catch (e) { showToast(e.message, 'error'); }
  }
  async function confirmCampContact(id, confirmed) {
    try {
      await api(`/api/patient/notifications/${id}/confirm-contact`, { method: 'POST', body: { confirmed } });
      showToast(confirmed ? 'Thanks for confirming!' : "Thanks. We've let the organisers know.", confirmed ? 'success' : 'info');
      await refresh(['notifs']);
    } catch (e) { showToast(e.message, 'error'); }
  }
  function downloadIcs(id) {
    const n = state.notifs.find((x) => x.notification_id === id); if (!n) return;
    const d = parseDay(n.event_date); if (!d) return;
    const ymd = (x) => `${x.getFullYear()}${String(x.getMonth() + 1).padStart(2, '0')}${String(x.getDate()).padStart(2, '0')}`;
    const end = new Date(d); end.setDate(end.getDate() + 1);
    const clean = (s) => String(s || '').replace(/[\\;,]/g, (m) => '\\' + m).replace(/\n/g, '\\n');
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MedPulse//Patient//EN', 'BEGIN:VEVENT',
      `UID:medpulse-camp-${id}@medpulse`, `DTSTAMP:${ymd(new Date())}T000000Z`, `DTSTART;VALUE=DATE:${ymd(d)}`, `DTEND;VALUE=DATE:${ymd(end)}`,
      `SUMMARY:${clean(n.campaign_title)}`, `LOCATION:${clean(n.venue)}`, `DESCRIPTION:${clean(n.campaign_description)}`,
      'BEGIN:VALARM', 'TRIGGER:-PT15H', 'ACTION:DISPLAY', 'DESCRIPTION:Health camp tomorrow', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    a.download = `health-camp-${id}.ics`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ================= Records ================= */
  function renderRecords() {
    const c = state.card || {};
    $('surveyCard').innerHTML = c.student_id ? `
      <div class="pt-card-h" style="margin:0"><div><h2>📝 Health survey</h2>
        <p class="pt-sub">Your family's health survey was done by <strong>${esc(c.student_name || 'a medical student')}</strong>${c.student_roll ? ` (Roll ${esc(c.student_roll)})` : ''}${c.college_name ? `, ${esc(c.college_name)}` : ''}. Readings below come from that survey and follow-up visits.</p></div></div>` : `
      <div class="pt-card-h" style="margin:0"><div><h2>📝 Health survey</h2>
        <p class="pt-sub">Was your family surveyed by a medical student? Connect it to see those health readings here.</p></div>
        <button class="pt-btn primary sm" onclick="PT.openLink()">🔗 Connect survey</button></div>`;
    const r = state.records || {};
    const meds = r.medications || [], conds = r.conditions || [], alls = r.allergies || [], fus = r.follow_ups || [];
    $('medCount').textContent = meds.length; $('condCount').textContent = conds.length; $('allergyCount').textContent = alls.length;
    const empty = (t) => `<div class="pt-empty" style="padding:14px">${t}</div>`;
    $('medicationsList').innerHTML = meds.length ? meds.map((m) => `
      <div class="pt-rec"><div><div class="t">${esc(m.name)} ${esc(m.dosage || '')}</div><div class="d">${esc(m.frequency || 'Daily')}${m.reason ? ` · for ${esc(m.reason)}` : ''}</div></div><span class="pt-pill ok">Taking</span></div>`).join('') : empty('No medicines recorded.');
    $('conditionsList').innerHTML = conds.length ? conds.map((x) => `
      <div class="pt-rec"><div><div class="t">${esc(x.condition_name)}</div><div class="d">${esc(x.notes || 'Being monitored')}</div></div><span class="pt-pill warn">${esc(x.status || 'Active')}</span></div>`).join('') : empty('No long-term conditions recorded.');
    $('allergiesList').innerHTML = alls.length ? alls.map((a) => `
      <div class="pt-rec"><div><div class="t" style="color:#b91c1c">${esc(a.allergen)}</div><div class="d">${esc(a.reaction || 'Reaction')}${a.allergy_type ? ` · ${esc(a.allergy_type)}` : ''}</div></div><span class="pt-pill bad">${esc(a.severity || 'Moderate')}</span></div>`).join('') : empty('No allergies recorded.');
    $('followupsTimeline').innerHTML = fus.length ? `<div class="pt-tl">${fus.map((f) => `
      <div class="pt-tl-item">
        <div class="h"><span>Visit #${esc(f.visit_number || 1)}</span><span>${esc(fmtDay(f.visit_date))}</span></div>
        <div class="b">${esc(f.clinical_notes || 'Routine check-up.')}</div>
        <div class="v">
          ${f.sbp && f.dbp ? `<span class="pt-pill ${(f.sbp >= 140 || f.dbp >= 90) ? 'bad' : 'mute'}">BP ${esc(f.sbp)}/${esc(f.dbp)}</span>` : ''}
          ${f.rbs ? `<span class="pt-pill ${f.rbs >= 200 ? 'bad' : 'mute'}">Sugar ${esc(f.rbs)}</span>` : ''}
          ${f.hb ? `<span class="pt-pill ${f.hb < 11 ? 'warn' : 'mute'}">Hb ${esc(f.hb)}</span>` : ''}
          ${f.health_progress ? `<span class="pt-pill ok">${esc(f.health_progress)}</span>` : ''}
        </div>
        ${f.next_visit_date ? `<div class="pt-sub" style="color:var(--pt-dark);margin-top:4px">📅 Next visit: ${esc(fmtDay(f.next_visit_date))}</div>` : ''}
      </div>`).join('')}</div>` : empty('No visits recorded yet.');
  }

  /* ================= Overview ================= */
  function renderOverview() {
    const F = state.family;
    if (!F || !F.members) { $('overviewFamily').innerHTML = '<div class="pt-empty">Loading family…</div>'; return; }
    const shown = F.members.slice(0, 6);
    $('overviewFamily').innerHTML = `
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
        ${shown.map((m) => `<span title="${esc(m.name)}" class="mem-av" style="width:36px;height:36px;flex-basis:36px;font-size:0.78rem;background:${avColor(m.name)}">${esc(initials(m.name))}</span>`).join('')}
        ${F.members.length > shown.length ? `<span class="mem-av" style="width:36px;height:36px;flex-basis:36px;font-size:0.78rem;background:#94a3b8">+${F.members.length - shown.length}</span>` : ''}
      </div>
      <div class="pt-sub">${F.members.length} member${F.members.length === 1 ? '' : 's'} · ${F.can_edit ? 'You manage this family' : 'View only'}</div>`;
  }
  function renderActionCentre() {
    const items = [];
    const c = state.card;
    if (c) {
      const comp = cardCompleteness(c);
      if (comp.missing.length) items.push({ ic: '▣', t: 'Complete your health card', d: `Add ${comp.missing.join(', ').toLowerCase()}`, btns: `<button class="pt-btn sm primary" onclick="showTab('profile')">Complete</button>` });
    }
    state.notifs.filter((n) => !isPast(n) && rsvpOf(n) === 'Pending').forEach((n) => items.push({
      ic: '📣', t: `Reply to: ${n.campaign_title}`, d: `${fmtDay(n.event_date) || 'Date TBA'} · matched ${n.matched_keyword}`,
      btns: `<button class="pt-btn sm primary" onclick="PT.sendRsvp(${n.notification_id}, 'Attending')">✅ I'll come</button><button class="pt-btn sm" onclick="PT.openCamp(${n.notification_id})">Other reply</button>`
    }));
    state.requests.filter((r) => r.status === 'Resolved' && !r.patient_confirmation).forEach((r) => items.push({
      ic: '🏥', t: 'Did the hospital sort this out?', d: `${r.reason} · ${r.department}${r.hospital_note ? ` · “${r.hospital_note}”` : ''}`,
      btns: `<button class="pt-btn sm" onclick="PT.confirmRequest(${r.id}, true)">👍 Yes</button><button class="pt-btn sm ghost-danger" onclick="PT.confirmRequest(${r.id}, false)">Not yet</button>`
    }));
    $('actionCentre').innerHTML = items.length ? items.map((i) => `
      <div class="pt-action"><div class="ic">${i.ic}</div><div class="grow"><div class="t">${esc(i.t)}</div><div class="d">${esc(i.d)}</div></div><div class="btns">${i.btns}</div></div>`).join('')
      : `<div class="pt-empty" style="padding:18px"><span class="big">🎉</span><strong>You're all caught up.</strong><br>Nothing needs your attention right now.</div>`;
    $('cntOverview').textContent = items.length || '';
  }

  /* ================= Link health survey (student referral) ================= */
  function openLink() { $('linkCode').value = ''; $('linkFeedback').style.display = 'none'; openModal('linkModal'); setTimeout(() => $('linkCode').focus(), 80); }
  let verifyTimer = null;
  function debounceVerify() { clearTimeout(verifyTimer); verifyTimer = setTimeout(verifyCode, 350); }
  async function verifyCode() {
    const code = $('linkCode').value.trim().toUpperCase(); const fb = $('linkFeedback');
    if (code.length < 4) { fb.style.display = 'none'; return; }
    try {
      const res = await fetch('/api/patient/verify-referral', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ referral_code: code }) });
      const d = await res.json();
      fb.style.display = 'block';
      if (res.ok && d.valid && d.student) {
        Object.assign(fb.style, { color: '#065f46', background: '#ecfdf5', border: '1px solid #a7f3d0' });
        fb.innerHTML = `✔ <strong>${esc(d.student.name)}</strong> · Roll ${esc(d.student.roll_number)} · ${esc(d.student.college_name || '')}`;
      } else {
        Object.assign(fb.style, { color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca' });
        fb.textContent = d.error || 'No student found with this code.';
      }
    } catch (e) { /* ignore */ }
  }
  async function submitLink() {
    const btn = $('linkSubmit'); busy(btn, true, 'Connecting…');
    try {
      const d = await api('/api/patient/link-referral', { method: 'POST', body: { referral_code: $('linkCode').value.trim() } });
      showToast(d.message || 'Health survey connected', 'success');
      if (d.patient) { try { const p = { ...d.patient }; delete p.pin; localStorage.setItem('medpulse_patient', JSON.stringify(p)); } catch (e) { /* ignore */ } }
      closeModal('linkModal');
      await loadAll();
    } catch (e) { showToast(e.message, 'error'); }
    finally { busy(btn, false); }
  }

  /* ================= Expose for inline handlers ================= */
  window.PT = { editFamily, addMember, editMember, removeMember, requestFor, confirmRequest, cancelRequest, sendRsvp, askRsvp, confirmCampContact, downloadIcs, openCamp, openLink };
  Object.assign(window, { toggleSidebar, closeSidebar, showTab, logoutPatient, closeModal, printCard, copyUid, saveProfile, saveMember, saveFamily, submitRequest, submitRsvpNote, submitLink, debounceVerify, setPatientLanguage });

  /* ================= Boot ================= */
  const start = () => {
    setupLanguage();
    const tab = location.hash.slice(1);
    showTab(TABS.includes(tab) ? tab : 'overview', false);
    loadAll();
    setInterval(() => { if (!document.hidden) refresh(['notifs', 'requests']); }, 60000);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
