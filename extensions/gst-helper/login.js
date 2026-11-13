// Runs on the GST portal's login page. When you clicked Open Portal (or
// Login) in CA Compliance Tool, it fills that client's user name and
// password; YOU type the captcha and press Login.
function setValue(el, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

// The site sends the details as it opens this tab; ask a few times in case they arrive a moment later.
function ask(attempt) {
  chrome.runtime.sendMessage({ type: "take-login" }, (login) => {
    if (login) fill(login);
    else if (attempt < 5) setTimeout(() => ask(attempt + 1), 600);
  });
}

function fill(login) {
  let tries = 0;
  const timer = setInterval(() => {
    const user = document.querySelector("#username") ?? document.querySelector("input[name='username']");
    const pass = document.querySelector("#user_pass") ?? document.querySelector("input[type='password']");
    if (user && pass) {
      clearInterval(timer);
      setValue(user, login.user);
      setValue(pass, login.pass);
      const captcha = document.querySelector("#captcha") ?? document.querySelector("input[id*='captcha' i]");
      if (captcha) captcha.focus();
    } else if (++tries > 40) clearInterval(timer);
  }, 500);
}

ask(0);
