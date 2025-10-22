/* Support Modal Management */

document.addEventListener('DOMContentLoaded', function() {
    // Модальное окно DonationAlerts
    const donationModal = document.getElementById('donationModal');
    const openDonationModalBtn = document.getElementById('openDonationModal');
    const closeDonationModalBtn = document.getElementById('closeModal');

    // Открыть DonationAlerts модальное окно
    if (openDonationModalBtn) {
        openDonationModalBtn.addEventListener('click', function() {
            donationModal.classList.add('active');
        });
    }

    // Закрыть DonationAlerts модальное окно
    function closeDonationModal() {
        if (donationModal) {
            donationModal.classList.remove('active');
        }
    }

    if (closeDonationModalBtn) {
        closeDonationModalBtn.addEventListener('click', closeDonationModal);
    }

    // Модальное окно Крипто
    const cryptoModal = document.getElementById('cryptoModal');
    const openCryptoModalBtn = document.getElementById('openCryptoModal');
    const closeCryptoModalBtn = document.getElementById('closeCryptoModal');

    // Открыть крипто модальное окно
    if (openCryptoModalBtn) {
        openCryptoModalBtn.addEventListener('click', function() {
            cryptoModal.classList.add('active');
        });
    }

    // Закрыть крипто модальное окно
    function closeCryptoModal() {
        if (cryptoModal) {
            cryptoModal.classList.remove('active');
        }
    }

    if (closeCryptoModalBtn) {
        closeCryptoModalBtn.addEventListener('click', closeCryptoModal);
    }

    // Закрыть при клике вне модального окна
    if (cryptoModal) {
        cryptoModal.addEventListener('click', function(e) {
            if (e.target === cryptoModal) {
                closeCryptoModal();
            }
        });
    }

    // Модальное окно Карты РФ
    const cardModal = document.getElementById('cardModal');
    const openCardModalBtn = document.getElementById('openCardModal');
    const closeCardModalBtn = document.getElementById('closeCardModal');

    // Открыть карта РФ модальное окно
    if (openCardModalBtn) {
        openCardModalBtn.addEventListener('click', function() {
            cardModal.classList.add('active');
        });
    }

    // Закрыть карта РФ модальное окно
    function closeCardModal() {
        if (cardModal) {
            cardModal.classList.remove('active');
        }
    }

    if (closeCardModalBtn) {
        closeCardModalBtn.addEventListener('click', closeCardModal);
    }

    // Закрыть при клике вне модального окна
    if (donationModal) {
        donationModal.addEventListener('click', function(e) {
            if (e.target === donationModal) {
                closeDonationModal();
            }
        });
    }

    if (cardModal) {
        cardModal.addEventListener('click', function(e) {
            if (e.target === cardModal) {
                closeCardModal();
            }
        });
    }

    // Закрыть по ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            if (donationModal && donationModal.classList.contains('active')) {
                closeDonationModal();
            }
            if (cryptoModal && cryptoModal.classList.contains('active')) {
                closeCryptoModal();
            }
            if (cardModal && cardModal.classList.contains('active')) {
                closeCardModal();
            }
        }
    });

    // Переключение табов криптовалют
    const cryptoTabs = document.querySelectorAll('.crypto-tab');
    const cryptoContents = document.querySelectorAll('.crypto-content');

    cryptoTabs.forEach(function(tab) {
        tab.addEventListener('click', function() {
            const cryptoType = this.getAttribute('data-crypto');
            
            // Убрать active со всех табов
            cryptoTabs.forEach(function(t) {
                t.classList.remove('active');
            });
            
            // Убрать active со всех контентов
            cryptoContents.forEach(function(c) {
                c.classList.remove('active');
            });
            
            // Добавить active к текущему табу
            this.classList.add('active');
            
            // Показать соответствующий контент
            const activeContent = document.querySelector('[data-crypto-content="' + cryptoType + '"]');
            if (activeContent) {
                activeContent.classList.add('active');
            }
        });
    });

    // Копирование адреса криптовалюты в буфер обмена
    const cryptoAddresses = document.querySelectorAll('.crypto-address');
    
    cryptoAddresses.forEach(function(addressEl) {
        addressEl.addEventListener('click', function() {
            const address = this.getAttribute('data-address');
            
            // Копирование в буфер обмена
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(address).then(function() {
                    // Показать что скопировано
                    addressEl.classList.add('copied');
                    
                    // Убрать класс через 2 секунды
                    setTimeout(function() {
                        addressEl.classList.remove('copied');
                    }, 2000);
                }).catch(function(err) {
                    console.error('Ошибка копирования:', err);
                    alert('Не удалось скопировать адрес');
                });
            } else {
                // Fallback для старых браузеров
                const textArea = document.createElement('textarea');
                textArea.value = address;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                document.body.appendChild(textArea);
                textArea.select();
                
                try {
                    document.execCommand('copy');
                    addressEl.classList.add('copied');
                    setTimeout(function() {
                        addressEl.classList.remove('copied');
                    }, 2000);
                } catch (err) {
                    console.error('Ошибка копирования:', err);
                    alert('Не удалось скопировать адрес');
                }
                
                document.body.removeChild(textArea);
            }
        });
    });
});

