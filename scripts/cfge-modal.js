// Config Injector Modal functionality
(function() {
    'use strict';
    
    document.addEventListener('DOMContentLoaded', function() {
        const openConfigInjectorBtn = document.getElementById('openConfigInjectorModal');
        const configInjectorModal = document.getElementById('configInjectorModal');
        const closeConfigInjectorModal = document.getElementById('closeConfigInjectorModal');
        
        if (openConfigInjectorBtn && configInjectorModal && closeConfigInjectorModal) {
            openConfigInjectorBtn.addEventListener('click', function() {
                configInjectorModal.classList.add('active');
                document.body.style.overflow = 'hidden';
            });
            
            closeConfigInjectorModal.addEventListener('click', function() {
                configInjectorModal.classList.remove('active');
                document.body.style.overflow = '';
            });
            
            configInjectorModal.addEventListener('click', function(e) {
                if (e.target === configInjectorModal) {
                    configInjectorModal.classList.remove('active');
                    document.body.style.overflow = '';
                }
            });
            
            // Close on Escape key
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape' && configInjectorModal.classList.contains('active')) {
                    configInjectorModal.classList.remove('active');
                    document.body.style.overflow = '';
                }
            });
        }
    });
})();

