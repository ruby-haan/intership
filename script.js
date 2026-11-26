const $ = (id) => document.getElementById(id);
const STORAGE_KEY = "internshipTrackerData";
const EMAIL_KEY = "internshipTrackerEmails";
let applications = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
let emails = JSON.parse(localStorage.getItem(EMAIL_KEY) || "[]");
let activeFilter = "All";
const CV_KEY = "internshipTrackerCV";
let cvSaveTimer;

const todayISO = () => new Date().toISOString().slice(0,10);
const datePlus = (date, days) => { const d = new Date(date + "T12:00:00"); d.setDate(d.getDate()+days); return d; };
const dayDiff = (a,b) => Math.floor((new Date(b+"T12:00:00") - new Date(a+"T12:00:00")) / 86400000);
const prettyDate = (date) => date ? new Date(date+"T12:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}) : "";
const save = () => { localStorage.setItem(STORAGE_KEY, JSON.stringify(applications)); localStorage.setItem(EMAIL_KEY, JSON.stringify(emails)); render(); };
const statusClass = s => "status-" + s;
const escapeHTML = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function getReminders() {
  const result = [];
  applications.forEach(app => {
    if (app.status === "Waiting") {
      const elapsed = dayDiff(app.dateApplied, todayISO());
      if (elapsed >= 7) result.push({id:"follow-"+app.id, type:"follow", title:`Follow up with ${app.company}`, detail:`No company reply for ${elapsed} days. Consider sending a polite follow-up.`, date:`Applied ${prettyDate(app.dateApplied)}`, overdue:elapsed>7});
    }
  });
  emails.forEach(mail => {
    if (!mail.replied) {
      const elapsed = dayDiff(mail.dateReceived, todayISO());
      const remaining = 3-elapsed;
      result.push({id:"email-"+mail.id, type:"email", title:`Reply to ${mail.company}`, detail:mail.details || "You received a new email. Remember to reply.", date:remaining>=0?`${remaining} day${remaining===1?"":"s"} left`:`${Math.abs(remaining)} day${Math.abs(remaining)===1?"":"s"} overdue`, overdue:remaining<0, mailId:mail.id});
    }
  });
  return result.sort((a,b)=>(b.overdue?1:0)-(a.overdue?1:0));
}

function empty(message, sub="") { return `<div class="empty-state"><strong>${message}</strong>${sub}</div>`; }
function appCard(app) {
  const initial = escapeHTML((app.company||"?").trim().charAt(0).toUpperCase());
  return `<article class="application-card"><div class="company-avatar">${initial}</div><div class="application-main"><strong>${escapeHTML(app.company)}</strong><p>Applied ${prettyDate(app.dateApplied)}${app.email?" · "+escapeHTML(app.email):""}</p></div><span class="status-pill ${statusClass(app.status)}">${app.status}</span><div class="card-actions"><button class="icon-btn" title="Edit" data-edit="${app.id}">✎</button><button class="icon-btn" title="Delete" data-delete="${app.id}">⌫</button></div></article>`;
}
function reminderCard(r) {
  return `<article class="reminder-card"><div class="reminder-symbol">${r.type==="follow"?"◷":"✉"}</div><div class="reminder-copy"><strong>${escapeHTML(r.title)}</strong><p>${escapeHTML(r.detail)}</p></div><span class="reminder-date">${escapeHTML(r.date)}</span>${r.type==="email"?`<button class="icon-btn" title="Mark as replied" data-replied="${r.mailId}">✓</button>`:""}</article>`;
}
function render() {
  const reminders=getReminders();
  $("totalCount").textContent=applications.length;
  $("waitingCount").textContent=applications.filter(a=>a.status==="Waiting").length;
  $("acceptedCount").textContent=applications.filter(a=>a.status==="Accepted").length;
  $("repliedCount").textContent=applications.filter(a=>a.status!=="Waiting").length;
  $("reminderBadge").textContent=reminders.length;
  $("dashboardReminders").innerHTML=reminders.length?reminders.slice(0,3).map(reminderCard).join(""):empty("You're all caught up!","No reminders right now.");
  const recent=[...applications].sort((a,b)=>b.dateApplied.localeCompare(a.dateApplied)).slice(0,4);
  $("recentApplications").innerHTML=recent.length?recent.map(appCard).join(""):empty("No applications yet","Add your first internship application to get started.");
  const query=$("searchInput").value.toLowerCase();
  const filtered=applications.filter(a=>(activeFilter==="All"||a.status===activeFilter)&&a.company.toLowerCase().includes(query)).sort((a,b)=>b.dateApplied.localeCompare(a.dateApplied));
  $("allApplications").innerHTML=filtered.length?filtered.map(appCard).join(""):empty("No applications found","Try another filter or add an application.");
  $("allReminders").innerHTML=reminders.length?reminders.map(reminderCard).join(""):empty("Nothing to remind you about","We'll show a reminder here when it's time.");
  $("emailCompany").innerHTML=applications.length?applications.map(a=>`<option value="${a.id}">${escapeHTML(a.company)}</option>`).join(""):"<option value=''>Add an application first</option>";
}
function showView(view) {
  ["dashboard","applications","cv","reminders"].forEach(v=>$(`${v}View`).classList.toggle("hidden",v!==view));
  document.querySelectorAll(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  $("pageTitle").textContent=view==="dashboard"?"Dashboard":view==="applications"?"Applications":view==="cv"?"My CV":"Reminders";
}
function openApplication(app=null) {
  $("applicationForm").reset(); $("editId").value=app?.id||"";
  $("formTitle").textContent=app?"Edit application":"Add an application";
  $("company").value=app?.company||""; $("dateApplied").value=app?.dateApplied||todayISO();
  $("status").value=app?.status||"Waiting"; $("email").value=app?.email||""; $("notes").value=app?.notes||"";
  $("applicationDialog").showModal();
}
function openEmail() {
  if(!applications.length){alert("Add an application first, then you can log an email from that company.");return;}
  $("emailForm").reset(); $("emailDate").value=todayISO(); $("emailDialog").showModal();
}
$("addTopButton").addEventListener("click",()=>openApplication());
$("closeDialog").onclick=$("cancelDialog").onclick=()=>$("applicationDialog").close();
$("closeEmailDialog").onclick=$("cancelEmailDialog").onclick=()=>$("emailDialog").close();
$("applicationForm").addEventListener("submit",e=>{
  e.preventDefault(); const id=$("editId").value||String(Date.now());
  const item={id,company:$("company").value.trim(),dateApplied:$("dateApplied").value,status:$("status").value,email:$("email").value.trim(),notes:$("notes").value.trim()};
  const index=applications.findIndex(a=>a.id===id); if(index>=0)applications[index]=item;else applications.push(item);
  $("applicationDialog").close();save();
});
$("emailForm").addEventListener("submit",e=>{
  e.preventDefault();const app=applications.find(a=>a.id===$("emailCompany").value);if(!app)return;
  emails.push({id:String(Date.now()),company:app.company,applicationId:app.id,dateReceived:$("emailDate").value,details:$("emailDetails").value.trim(),replied:false});
  $("emailDialog").close();save();
});
$("statusTabs").addEventListener("click",e=>{const b=e.target.closest("[data-filter]");if(!b)return;activeFilter=b.dataset.filter;document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t===b));render();});
$("searchInput").addEventListener("input",render);
document.addEventListener("click",e=>{
  const edit=e.target.closest("[data-edit]");if(edit){const app=applications.find(a=>a.id===edit.dataset.edit);if(app)openApplication(app);}
  const del=e.target.closest("[data-delete]");if(del){const app=applications.find(a=>a.id===del.dataset.delete);if(app&&confirm(`Delete the application for ${app.company}?`)){applications=applications.filter(a=>a.id!==app.id);emails=emails.filter(m=>m.applicationId!==app.id);save();}}
  const replied=e.target.closest("[data-replied]");if(replied){const mail=emails.find(m=>m.id===replied.dataset.replied);if(mail){mail.replied=true;save();}}
  const goto=e.target.closest("[data-goto]");if(goto)showView(goto.dataset.goto);
});
document.querySelectorAll(".nav-link").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));

// Quick way to log an email: double-click the Reminders navigation item.
document.querySelector('[data-view="reminders"]').addEventListener("dblclick",openEmail);
// CV editor: save changes locally, import plain-text CVs, and export or print.
const cvText = $("cvText");
cvText.value = localStorage.getItem(CV_KEY) || "";
cvText.addEventListener("input", () => {
  $("cvSaveStatus").textContent = "Saving...";
  clearTimeout(cvSaveTimer);
  cvSaveTimer = setTimeout(() => {
    localStorage.setItem(CV_KEY, cvText.value);
    $("cvSaveStatus").textContent = "Saved automatically";
  }, 350);
});
$("cvUpload").addEventListener("change", async (e) => {
  const file = e.target.files[0]; if (!file) return;
  try {
    cvText.value = await file.text();
    localStorage.setItem(CV_KEY, cvText.value);
    $("cvSaveStatus").textContent = `Imported ${file.name} · saved`;
  } catch { alert("This file could not be read. Please use a .txt file."); }
  e.target.value = "";
});
$("downloadCv").addEventListener("click", () => {
  const blob = new Blob([cvText.value], {type:"text/plain;charset=utf-8"});
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href=url; a.download="my-cv.txt"; a.click(); URL.revokeObjectURL(url);
});
$("printCv").addEventListener("click", () => {
  const w = window.open("", "_blank"); if (!w) { alert("Please allow pop-ups to print your CV."); return; }
  w.document.write(`<!doctype html><html><head><title>My CV</title><style>body{font:14px Arial,sans-serif;line-height:1.55;white-space:pre-wrap;color:#222;max-width:800px;margin:45px auto;padding:0 25px}@media print{body{margin:15mm auto}}</style></head><body>${escapeHTML(cvText.value).replace(/\n/g,"<br>")}</body></html>`);
  w.document.close(); w.focus(); w.print();
});

render();


// CV photo upload: resize large images before storing them in this browser.
const CV_PHOTO_KEY = "internshipTrackerCVPhoto";
const cvPhotoPreview = $("cvPhotoPreview");
const removeCvPhotoButton = $("removeCvPhoto");

function showCvPhoto(dataUrl) {
  if (dataUrl) {
    cvPhotoPreview.innerHTML = `<img src="${dataUrl}" alt="Uploaded photo or scan of your CV">`;
    removeCvPhotoButton.classList.remove("hidden");
  } else {
    cvPhotoPreview.innerHTML = `<div class="cv-photo-empty"><span>▧</span><strong>No CV photo uploaded yet</strong><small>Your uploaded CV photo will appear here.</small></div>`;
    removeCvPhotoButton.classList.add("hidden");
  }
}
showCvPhoto(localStorage.getItem(CV_PHOTO_KEY));

$("cvPhotoUpload").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    alert("Please choose an image file, such as JPG, PNG or WEBP.");
    event.target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      const maxSide = 1800;
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const compressedImage = canvas.toDataURL("image/jpeg", 0.82);
      try {
        localStorage.setItem(CV_PHOTO_KEY, compressedImage);
        showCvPhoto(compressedImage);
      } catch (error) {
        alert("This image is too large to save in your browser. Try a smaller photo.");
      }
    };
    image.onerror = () => alert("This image could not be opened. Please try another photo.");
    image.src = reader.result;
  };
  reader.onerror = () => alert("This image could not be read. Please try again.");
  reader.readAsDataURL(file);
  event.target.value = "";
});

removeCvPhotoButton.addEventListener("click", () => {
  if (confirm("Remove the uploaded CV photo?")) {
    localStorage.removeItem(CV_PHOTO_KEY);
    showCvPhoto(null);
  }
});
