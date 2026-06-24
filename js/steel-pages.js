(function () {
  var header = document.querySelector(".site-header");
  var menuButton = document.querySelector(".mobile-menu");
  var navigation = document.querySelector(".site-nav");
  var reveals = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
  var form = document.querySelector("#inquiry-form");

  function updateHeader() {
    header.classList.toggle("is-scrolled", window.scrollY > 24);
  }

  if (menuButton && navigation) {
    menuButton.addEventListener("click", function () {
      var isOpen = navigation.classList.toggle("is-open");
      menuButton.setAttribute("aria-expanded", String(isOpen));
      menuButton.textContent = isOpen ? "\u00d7" : "+";
    });
  }

  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) entry.target.classList.add("is-visible");
      });
    }, { threshold: 0.12 });
    reveals.forEach(function (item) { observer.observe(item); });
  } else {
    reveals.forEach(function (item) { item.classList.add("is-visible"); });
  }

  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var data = new FormData(form);
      var subject = "Stainless Steel Inquiry - " + (data.get("company") || data.get("name"));
      var body = [
        "Name: " + data.get("name"),
        "Company: " + data.get("company"),
        "Email: " + data.get("email"),
        "Phone / WhatsApp: " + data.get("phone"),
        "Grade: " + data.get("grade"),
        "Product form: " + data.get("form"),
        "",
        "Specifications and quantity:",
        data.get("requirements")
      ].join("\n");
      window.location.href = "mailto:vip@still-steel.com?subject=" +
        encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
    });
  }

  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });
})();
