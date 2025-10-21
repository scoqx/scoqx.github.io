// Simple debug - just show sizes
console.log('🔍 Simple debug loaded');

// Override ALL style changes
const originalSetProperty = CSSStyleDeclaration.prototype.setProperty;
CSSStyleDeclaration.prototype.setProperty = function(property, value, priority) {
  console.log('🚨 CSS SETPROPERTY:', property, '=', value);
  return originalSetProperty.call(this, property, value, priority);
};

// Override ALL style assignments
const originalStyleSetter = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'style').set;
Object.defineProperty(HTMLElement.prototype, 'style', {
  set: function(value) {
    console.log('🚨 STYLE SET:', value, 'on', this.tagName, this.className);
    return originalStyleSetter.call(this, value);
  },
  get: function() {
    return originalStyleSetter.call(this);
  }
});

function showSizes() {
  const navLinks = document.querySelectorAll('nav a');
  console.log('📏 Nav sizes:');
  navLinks.forEach((link, index) => {
    const style = getComputedStyle(link);
    console.log(`  Nav ${index}: ${style.fontSize}`);
  });
  
  const h2 = document.querySelector('h2');
  if (h2) {
    const style = getComputedStyle(h2);
    console.log(`📏 H2: ${style.fontSize}`);
  }
  
  const h3 = document.querySelector('h3');
  if (h3) {
    const style = getComputedStyle(h3);
    console.log(`📏 H3: ${style.fontSize}`);
  }
  
  const logo = document.querySelector('.logo-icon');
  if (logo) {
    const style = getComputedStyle(logo);
    console.log(`📏 Logo: width=${style.width}, height=${style.height}`);
  }
}

// Show sizes every 2 seconds
setInterval(showSizes, 2000);

// Show sizes on click
document.addEventListener('click', () => {
  console.log('🔍 Click - sizes:');
  showSizes();
});

console.log('🔍 Simple debug ready');
