import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// Paste your project's Project URL and anon/public key here after creating a Supabase project.
const SUPABASE_URL = "https://qaomxoifjnjzwchxaqmn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_NXhsJlMGMoYDeuzya1ivpw_98gwosTY";

const $ = id => document.getElementById(id);
const STORAGE_KEYS = [
  "internshipTrackerData",
  "internshipTrackerEmails",
  "internshipTrackerCV",
  "internshipTrackerCVPhoto",
  "internshipTrackerSavedInternships"
];
let supabase;
let currentUser = null;
let syncingFromCloud = false;
let syncTimer;

function showMessage(message, isError=false) {
  $("authMessage").textContent = message;
  $("authMessage").style.color = isError ? "#b84d70" : "#8d5a82";
}
function setMode(signUp) {
  $("authTitle").textContent = signUp ? "Create your account" : "Welcome back";
  $("authSubmit").textContent = signUp ? "Create free account" : "Log in";
  $("toggleAuthMode").textContent = signUp ? "Already have an account? Log in" : "Create a free account";
  $("authPassword").autocomplete = signUp ? "new-password" : "current-password";
  $("authForm").dataset.mode = signUp ? "signup" : "login";
  showMessage("");
}
function localData() {
  const data = {};
  STORAGE_KEYS.forEach(key => { data[key] = localStorage.getItem(key); });
  return data;
}
function applyCloudData(data) {
  syncingFromCloud = true;
  STORAGE_KEYS.forEach(key => {
    if (data && Object.prototype.hasOwnProperty.call(data,key) && data[key] !== null) {
      localStorage.setItem(key, data[key]);
    } else {
      localStorage.removeItem(key);
    }
  });
  syncingFromCloud = false;
}
async function loadUserData() {
  const { data, error } = await supabase.from("user_data").select("data").eq("user_id",currentUser.id).maybeSingle();
  if (error) throw error;
  if (data?.data) {
    applyCloudData(data.data);
  } else {
    // First sign-in: migrate this browser's existing tracker data into the new account.
    await saveUserData();
  }
}
async function saveUserData() {
  if (!currentUser || syncingFromCloud) return;
  const { error } = await supabase.from("user_data").upsert({
    user_id: currentUser.id,
    data: localData(),
    updated_at: new Date().toISOString()
  }, { onConflict: "user_id" });
  if (error) {
    console.error("Cloud save failed:", error);
    showMessage("Your account is signed in, but cloud saving failed. Check your Supabase setup.", true);
  }
}
function scheduleCloudSave() {
  if (!currentUser || syncingFromCloud) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(saveUserData, 700);
}
function connectLocalStorageToCloud() {
  const originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function(key, value) {
    originalSetItem.call(this,key,value);
    if (this === localStorage && STORAGE_KEYS.includes(String(key))) scheduleCloudSave();
  };
  const originalRemoveItem = Storage.prototype.removeItem;
  Storage.prototype.removeItem = function(key) {
    originalRemoveItem.call(this,key);
    if (this === localStorage && STORAGE_KEYS.includes(String(key))) scheduleCloudSave();
  };
}
async function enterApp(user) {
  currentUser = user;
  $("signedInEmail").textContent = user.email || "Signed in";
  $("authScreen").classList.add("hidden");
  $("appShell").classList.remove("hidden");
  await loadUserData();
  // Refresh app state from localStorage after cloud data has been applied.
  window.location.reload();
}
async function start() {
  if (SUPABASE_URL.startsWith("YOUR_") || SUPABASE_ANON_KEY.startsWith("YOUR_")) {
    showMessage("Setup needed: add your Supabase Project URL and anon key in auth.js.", true);
    $("authForm").addEventListener("submit", e => {
      e.preventDefault();
      showMessage("First complete the Supabase setup using the included setup guide.", true);
    });
    $("toggleAuthMode").disabled = true;
    $("resetPasswordButton").disabled = true;
    return;
  }
  supabase = createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
  connectLocalStorageToCloud();
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    try {
      currentUser = session.user;
      const { data, error } = await supabase.from("user_data").select("data").eq("user_id",currentUser.id).maybeSingle();
      if (error) throw error;
      if (data?.data) {
        const before = JSON.stringify(localData());
        applyCloudData(data.data);
        if (before !== JSON.stringify(localData())) { window.location.reload(); return; }
      } else {
        await saveUserData();
      }
      $("signedInEmail").textContent = currentUser.email || "Signed in";
      $("authScreen").classList.add("hidden");
      $("appShell").classList.remove("hidden");
    } catch (error) {
      console.error(error);
      showMessage("Could not load your saved data. Check your database setup and internet connection.", true);
    }
  } else {
    $("appShell").classList.add("hidden");
    $("authScreen").classList.remove("hidden");
  }
  $("authForm").addEventListener("submit", async e => {
    e.preventDefault();
    const email=$("authEmail").value.trim();
    const password=$("authPassword").value;
    $("authSubmit").disabled=true;
    showMessage("Please wait...");
    try {
      let result;
      if ($("authForm").dataset.mode==="signup") {
        result=await supabase.auth.signUp({email,password});
        if (result.error) throw result.error;
        if (!result.data.session) {
          showMessage("Account created. Check your email to confirm, then log in.");
        } else {
          await enterApp(result.data.user);
        }
      } else {
        result=await supabase.auth.signInWithPassword({email,password});
        if (result.error) throw result.error;
        await enterApp(result.data.user);
      }
    } catch(error) {
      showMessage(error.message || "Something went wrong. Please try again.",true);
    } finally { $("authSubmit").disabled=false; }
  });
  $("toggleAuthMode").addEventListener("click",()=>{
    setMode($("authForm").dataset.mode!=="signup");
  });
  $("resetPasswordButton").addEventListener("click",async()=>{
    const email=$("authEmail").value.trim();
    if(!email){showMessage("Enter your email address first.",true);return;}
    const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:window.location.href});
    showMessage(error ? error.message : "If an account exists for this address, a password-reset email has been sent.",!!error);
  });
  $("signOutButton").addEventListener("click",async()=>{
    await saveUserData();
    await supabase.auth.signOut();
    // Clear this browser's cached copy so a different person using this device
    // cannot accidentally inherit the previous account's data on first signup.
    STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
    currentUser=null;
    $("appShell").classList.add("hidden");
    $("authScreen").classList.remove("hidden");
    setMode(false);
  });
  setMode(false);
  // Handle another tab signing out.
  supabase.auth.onAuthStateChange(async(event,session)=>{
    if(event==="SIGNED_OUT"){
      STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
      currentUser=null;
      $("appShell").classList.add("hidden");
      $("authScreen").classList.remove("hidden");
    }
  });
}
start().catch(error=>{
  console.error(error);
  showMessage("Could not connect to Supabase. Check the URL, public key and database setup.",true);
});
