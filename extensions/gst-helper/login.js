// Runs on the GST portal's login page. When you clicked Open Portal (or
// Login) in CA Compliance Tool, it fills that client's user name and
// password; YOU type the captcha and press Login. A small note at the top
// right says what happened, so a failed fill is easy to spot.

function setValue(el, value) {
  el.focus();
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  setter.call(el, value);
  // The portal's form listens for typing; send the events a person's typing would.
  for (const type of ["keydown", "keypress", "input", "keyup", "change"]) {
    const Ev = type.startsWith("key") ? KeyboardEvent : Event;
    el.dispatchEvent(new Ev(type, { bubbles: true }));
  }
  el.dispatchEvent(new Event("blur", { bubbles: true }));
}

function note(text, ok) {
  let box = document.getElementById("cact-gst-note");
  if (!box) {
    box = document.createElement("div");
    box.id = "cact-gst-note";
    box.style.cssText =
      "position:fixed;top:10px;right:10px;z-index:2147483647;max-width:320px;padding:9px 13px;border-radius:10px;font:13px/1.4 system-ui,Segoe UI,sans-serif;color:#fff;box-shadow:0 6px 20px #0006";
    document.body.appendChild(box);
  }
  box.style.background = ok ? "#12805a" : "#30386b";
  box.textContent = `CA Compliance Tool: ${text}`;
  if (ok) setTimeout(() => box.remove(), 6000);
}

function findUser() {
  return (
    document.querySelector("#username") ??
    document.querySelector("input[name='username']") ??
    document.querySelector("input[placeholder*='Username' i]")
  );
}

function findPass() {
  return document.querySelector("#user_pass") ?? document.querySelector("input[type='password']");
}

function fill(login) {
  let tries = 0;
  const timer = setInterval(() => {
    const user = findUser();
    const pass = findPass();
    if (user && pass) {
      clearInterval(timer);
      setValue(user, login.user);
      setValue(pass, login.pass);
      // The captcha box can appear only after the user name is entered.
      setTimeout(() => {
        const captcha = document.querySelector("#captcha") ?? document.querySelector("input[id*='captcha' i]");
        if (captcha) captcha.focus();
      }, 400);
      note(`filled the login for ${login.user}. Type the captcha and press Login.`, true);
    } else if (++tries > 40) {
      clearInterval(timer);
      note("could not find the Username and Password boxes on this page.", false);
    }
  }, 500);
}

// The site sends the details as this tab opens; ask a few times in case they arrive a moment later.
function ask(attempt) {
  chrome.runtime.sendMessage({ type: "take-login" }, (login) => {
    if (chrome.runtime.lastError) {
      // The extension was reloaded or is starting up: try again shortly.
      if (attempt < 8) setTimeout(() => ask(attempt + 1), 600);
      return;
    }
    if (login) fill(login);
    else if (attempt < 8) setTimeout(() => ask(attempt + 1), 600);
    else note("no login details received. Open the portal from CA Compliance Tool's Open Portal button.", false);
  });
}

ask(0);
