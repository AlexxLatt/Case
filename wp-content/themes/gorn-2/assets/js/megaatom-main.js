/**
 * MegaAtom Main Page JavaScript
 * Подключается только на главной странице
 */

'use strict';

// ============================================
// УДАЛЕНИЕ СТАРОЙ ТАБЛИЦЫ ПРИ ЗАГРУЗКЕ ФАЙЛА
// ============================================
document.addEventListener('click', (e) => {
    if (e.target.matches('.modal-upload__submit')) {
        const oldTable = document.getElementById('getTable');
        if (oldTable) {
            oldTable.remove();
        }
    }
});

// ============================================
// УСПЕШНЫЙ МОДАЛ
// ============================================
function showSuccessModal() {
    const successHtml = `
    <div class="gem-success-overlay">
        <div class="gem-success-modal">
            <h2 class="gem-success-title">Заявка отправлена!</h2>
            <p class="gem-success-descr">Запрос на квотирование успешно отправлен. Обычно результаты квотирования мы предоставляем не позднее 48 часов</p>
            <button class="gem-success-close-btn">Ок</button>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', successHtml);

    const closeSuccess = () => {
        const overlay = document.querySelector('.gem-success-overlay');
        if (overlay) overlay.remove();
    };
    
    document.querySelector('.gem-success-close-btn')?.addEventListener('click', closeSuccess);
    document.querySelector('.gem-success-overlay')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('gem-success-overlay')) closeSuccess();
    });
}

// ============================================
// ОТПРАВКА ФОРМЫ ЗАПРОСА КВОТЫ
// ============================================
document.addEventListener('submit', async (e) => {
    const form = e.target;
    
    if (form.matches('form.order-form') && form.querySelector('[name="action"][value="submit_component_request"]')) {
        e.preventDefault();
        const submitBtn = form.querySelector('#quoteSubmitBtn');
        if (!submitBtn) return;
        
        const actionUrl = window.ajax_object?.ajax_url || '/wp-admin/admin-ajax.php';
        
        try {
            const response = await fetch(actionUrl, {
                method: 'POST',
                body: new FormData(form)
            });

            if (!response.ok) {
                throw new Error('Сервер вернул ошибку: ' + response.status);
            }

            const data = await response.json();
            if (data.success) {
               showSuccessModal();
                form.reset();
            } else {
                alert('Ошибка: ' + (data.data || 'Неизвестная ошибка'));
            }
        } catch (err) {
            console.error('Ошибка отправки:', err);
            alert('Не удалось отправить запрос. Проверьте соединение и попробуйте снова.');
        }
    }
});

// ============================================
// КОПИРОВАНИЕ URL
// ============================================
document.addEventListener('click', (e) => {
    const link = e.target.closest('.copy-url-link');
    if (link) {
        e.preventDefault();
        const href = link.getAttribute('data-link') || link.href;
        if (href) {
            navigator.clipboard.writeText(href)
                .then(() => alert('Ссылка скопирована!'))
                .catch(err => {
                    console.error('Не удалось скопировать:', err);
                    alert('Ошибка: не удалось скопировать ссылку');
                });
        }
    }
});

// ============================================
// ИНИЦИАЛИЗАЦИЯ ПОИСКА (ОСНОВНОЙ БЛОК)
// ============================================
function initProductSearch() {
    if (!window.megaatom_ajax_object) return;

    const ajaxurl = window.megaatom_ajax_object.ajax_url;
    const nonce = window.megaatom_ajax_object.nonce;
    const resultsContainer = document.getElementById('product-search-results');
    const searchForm = document.getElementById('product-search-form');
    const singleSearchInput = document.getElementById('single-search-input');
    const singleSearchInputQuantity = document.getElementById('single-search-input-quanity');
    const listSearchInput = document.getElementById('list-search-input');
    const searchModeSingle = document.getElementById('search-mode-single');
    const searchModeList = document.getElementById('search-mode-list');
    const excelUpload = document.getElementById('excel-upload');
    const uploadFilename = document.querySelector('[data-upload-filename]');
    
    const modalShadow = document.querySelector('[data-shadow]');
    const modalUpload = document.querySelector('[data-modal-upload]');
    const uploadTrigger = document.querySelector('[data-upload]');
    const modalClosers = document.querySelectorAll('[data-modal-close]');

    // ============================================
    // ОЧИСТКА ОШИБОК ВАЛИДАЦИИ
    // ============================================
    function clearSearchErrors() {
        document.querySelectorAll('.search__error').forEach(el => el.remove());
        singleSearchInput?.classList.remove('search__input--invalid');
        singleSearchInputQuantity?.classList.remove('search__input--invalid');
        listSearchInput?.classList.remove('search__input--invalid');
        searchForm?.classList.remove('invalid');
    }

    // ============================================
    // МОДАЛЬНОЕ ОКНО ЗАГРУЗКИ
    // ============================================
    uploadTrigger?.addEventListener('click', (e) => {
        e.preventDefault();
        modalShadow?.classList.add('visible');
        modalUpload?.classList.add('visible');
    });

    modalClosers.forEach(closer => {
        closer.addEventListener('click', () => {
            modalShadow?.classList.remove('visible');
            modalUpload?.classList.remove('visible');
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            modalShadow?.classList.remove('visible');
            modalUpload?.classList.remove('visible');
        }
    });

    // ============================================
    // ПЕРЕКЛЮЧЕНИЕ РЕЖИМОВ ПОИСКА
    // ============================================
    searchModeList?.addEventListener('change', () => {
        if (searchModeList.checked) {
            clearSearchErrors();
            singleSearchInput?.classList.add('disable');
            singleSearchInputQuantity?.classList.add('disable');
            listSearchInput?.classList.remove('disable');
            listSearchInput.placeholder = 'Поиск по артикулу\nC1005X6S1C105K:20\nC1005X6S1C105K:30\nC1005X6S1C105K:40\nC1005X6S1C105K:50';
            listSearchInput?.focus();
        }
    });

    searchModeSingle?.addEventListener('change', () => {
        if (searchModeSingle.checked) {
            clearSearchErrors();
            listSearchInput?.classList.add('disable');
            singleSearchInput?.classList.remove('disable');
            singleSearchInput.placeholder = 'Поиск по артикулу';
            singleSearchInput?.focus();
            singleSearchInputQuantity?.classList.remove('disable');
            singleSearchInputQuantity.placeholder = 'Кол-во';
            singleSearchInputQuantity?.focus();
        }
    });

    // ============================================
    // ПЕРЕТАСКИВАНИЕ ФАЙЛА
    // ============================================
    const dropzone = document.querySelector('[data-dropzone]');
    if (dropzone) {
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add('drag-over');
        });

        dropzone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('drag-over');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('drag-over');
            if (e.dataTransfer.files && e.dataTransfer.files.length) {
                handleFileDrop(e.dataTransfer.files);
            }
        });
    }

    function handleFileDrop(files) {
        if (files.length > 0) {
            const file = files[0];
            const isValid = validateFile(file);
            if (isValid) {
                excelUpload.files = files;
                if (excelUpload.files.length > 0) {
                    uploadFilename.textContent = excelUpload.files[0].name;
                }
            } else {
                alert('Неверный формат файла. Разрешены только .xls, .xlsx, .csv');
            }
        }
    }

    function validateFile(file) {
        const fileName = file.name.toLowerCase();
        const validExtensions = ['.xls', '.xlsx', '.csv'];
        return validExtensions.some(ext => fileName.endsWith(ext));
    }

    // ============================================
    // ПОИСК ТОВАРОВ
    // ============================================
    function search() {
        const isSingleMode = searchModeSingle.checked;
        let query = '';
        
        if (isSingleMode) {
            const article = singleSearchInput.value.trim();
            const quantity = singleSearchInputQuantity.value.trim() || '1';
            if (!article) {
                alert('Введите артикул для поиска');
                return;
            }
            query = article + ':' + quantity;
        } else {
            query = listSearchInput.value.trim();
        }

        const getTable = document.getElementById('getTable');
        if (getTable) {
            getTable.remove();
        }

        resultsContainer.innerHTML = `
            <div class="search-loading">
                <img src="${window.megaatom_ajax_object.theme_uri}/images/loading.gif" alt="Загрузка..." style="width: 60px; height: 60px;">
            </div>
        `;

        if (!query) {
            alert('Введите артикул для поиска');
            return;
        }

        if (isSingleMode) {
            postData(ajaxurl, {
                action: 'product_search_by_article',
                article: query,
                security: nonce
            }).then(handleSearchResponse).catch(handleSearchError);
        } else {
            postData(ajaxurl, {
                action: 'product_search_by_list',
                articles: query,
                security: nonce
            }).then(handleSearchResponse).catch(handleSearchError);
        }
    }

    function handleSearchResponse(response) {
        if (response.success) {
            resultsContainer.innerHTML = response.data;
            initQuantityInputs();
            initCartButtons();
        } else {
            resultsContainer.innerHTML = '<div class="error">Ошибка: ' + response.data + '</div>';
        }
    }

    function handleSearchError(error) {
        resultsContainer.innerHTML = '<div class="error">Ошибка запроса</div>';
        console.error('Search error:', error);
    }

    // ============================================
    // ОТПРАВКА ФОРМЫ ПОИСКА
    // ============================================
    searchForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        if (validationForm()) {
            search();
        }
    });

    // ============================================
    // ВАЛИДАЦИЯ ФОРМЫ
    // ============================================
    function showSearchError(field, message) {
        if (!field) return;
        const existing = field.nextElementSibling?.classList.contains('search__error');
        if (existing) field.nextElementSibling.remove();
        
        const error = document.createElement('span');
        error.className = 'search__error';
        error.textContent = message;
        field.after(error);
        field.classList.add('search__input--invalid');
        searchForm?.classList.add('invalid');
    }

    function validationForm() {
        clearSearchErrors();
        const errorText = "Поисковая строка может содержать только латинские буквы (a-z)(A-Z) или только кириллические буквы (а-я)(А-Я), цифры (0-9) и знаки.";
        const isSingleMode = searchModeSingle.checked;
        const isListMode = searchModeList.checked;

        function isValidLine(str) {
            if (!str) return false;
            const hasCyrillic = /[а-яА-ЯёЁ]/u.test(str);
            const hasLatin = /[a-zA-Z]/.test(str);
            return !(hasCyrillic && hasLatin);
        }

        if (isListMode) {
            const value = listSearchInput.value.trim();
            if (!value) {
                showSearchError(listSearchInput, "Поле не может быть пустым.");
                return false;
            }
            const lines = value
                .split(/\r?\n/)
                .map(line => line.trim())
                .filter(line => line.length > 0);
            for (const line of lines) {
                if (!isValidLine(line)) {
                    showSearchError(listSearchInput, `${errorText} Нарушение в одной из строк.`);
                    return false;
                }
            }
            return true;
        } else if (isSingleMode) {
            const value = singleSearchInput.value.trim();
            if (!value) {
                showSearchError(singleSearchInput, "Поле не может быть пустым.");
                return false;
            }
            if (!isValidLine(value)) {
                showSearchError(singleSearchInput, errorText);
                return false;
            }
            return true;
        }

        return false;
    }

    // ============================================
    // ЗАГРУЗКА ФАЙЛА
    // ============================================
    async function handleFileUpload(file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('action', 'product_search_by_file');
        formData.append('security', nonce);

        resultsContainer.innerHTML = `
            <div class="search-loading">
                <img src="${window.megaatom_ajax_object.theme_uri}/images/loading.gif" alt="Загрузка..." style="width: 60px; height: 60px;">
            </div>
        `;

        try {
            const response = await fetch(ajaxurl, {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            handleSearchResponse(data);
            modalShadow?.classList.remove('visible');
            modalUpload?.classList.remove('visible');
        } catch (error) {
            resultsContainer.innerHTML = '<div class="error">Ошибка загрузки файла</div>';
            console.error('File upload error:', error);
        }
    }

    document.querySelector('.modal-upload__submit')?.addEventListener('click', () => {
        if (excelUpload.files.length) {
            handleFileUpload(excelUpload.files[0]);
        } else {
            alert('Выберите файл для загрузки');
        }
    });

    excelUpload?.addEventListener('change', function() {
        if (this.files.length) {
            uploadFilename.textContent = this.files[0].name;
        } else {
            uploadFilename.textContent = 'Выбрать файл';
        }
    });

    // ============================================
    // СОРТИРОВКА ТАБЛИЦЫ
    // ============================================
    document.addEventListener('click', (e) => {
        const header = e.target.closest('.sortable');
        if (!header) return;
        e.preventDefault();

        const table = header.closest('table');
        const column = header.dataset.sort;
        const arrowUp = header.querySelector('.arrow-up');
        const arrowDown = header.querySelector('.arrow-down');
        let order = 'asc';
        
        if (arrowUp && arrowUp.classList.contains('active')) {
            order = 'desc';
        } else if (arrowDown && arrowDown.classList.contains('active')) {
            order = 'none';
        }

        sortTable(table, column, order);

        table.querySelectorAll('.sort-arrows .active').forEach(el => el.classList.remove('active'));
        if (order === 'asc' && arrowUp) arrowUp.classList.add('active');
        if (order === 'desc' && arrowDown) arrowDown.classList.add('active');
    });

    function sortTable(table, column, order) {
        const tbody = table.querySelector('tbody');
        if (!tbody) return;
        const rows = Array.from(tbody.querySelectorAll('tr'));
        
        if (order !== 'none') {
            rows.sort((a, b) => {
                let aVal, bVal;
                
                if (column === 'term') {
                    aVal = a.querySelector('.term')?.dataset.value || '';
                    bVal = b.querySelector('.term')?.dataset.value || '';
                    const parse = t => {
                        if (!t || t === 'Под заказ') return 999;
                        const n = t.match(/\d+/);
                        return n ? +n[0] : 500;
                    };
                    aVal = parse(aVal);
                    bVal = parse(bVal);
                } else if (column === 'price_rub' || column === 'total_rub') {
                    const cls = column.replace('_', '-');
                    aVal = parseFloat(a.querySelector(`.${cls}`)?.dataset.value) || 0;
                    bVal = parseFloat(b.querySelector(`.${cls}`)?.dataset.value) || 0;
                } else {
                    aVal = (a.querySelector(`.${column}`)?.textContent || '').trim().toLowerCase();
                    bVal = (b.querySelector(`.${column}`)?.textContent || '').trim().toLowerCase();
                }
                
                return order === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
            });
        }

        tbody.innerHTML = '';
        rows.forEach(row => tbody.appendChild(row));
    }

    // ============================================
    // ИНИЦИАЛИЗАЦИЯ ПОЛЕЙ КОЛИЧЕСТВА
    // ============================================
    function initQuantityInputs() {
        document.querySelectorAll('.quantity-input').forEach(input => {
            updateQuantityInput(input);
            input.addEventListener('change', () => updateQuantityInput(input));
            input.addEventListener('input', () => updateQuantityInput(input));
        });
    }

    function updateQuantityInput(input) {
        const minQ = parseInt(input.getAttribute('min')) || 1;
        const maxQ = parseInt(input.getAttribute('max')) || 1;
        let quantity = parseInt(input.value) || minQ;
        const row = input.closest('tr');
        const priceRub = row.querySelector('.price-rub');
        const totalRub = row.querySelector('.total-rub');
        const folddivision = row.querySelector('.folddivision');
        const available = row.querySelector('.available');
        const minqEl = row.querySelector('.minq');
        const addToCartBtn = row.querySelector('.add-to-cart-btn');

        let foldValue = 1;
        if (folddivision) {
            const foldText = folddivision.textContent.trim();
            const match = foldText.match(/Кратность:\s*(\d+)/i);
            if (match && match[1]) {
                foldValue = parseInt(match[1]) || 1;
            }
        }

        const isMultiple = (quantity % foldValue === 0);

        available.style.color = '';
        folddivision.style.color = '';
        minqEl.style.color = '';
        addToCartBtn.classList.remove('disabled');
        addToCartBtn.disabled = false;

        if (!isMultiple) {
            folddivision.style.color = 'red';
            addToCartBtn.classList.add('disabled');
            addToCartBtn.disabled = true;
        }
        if (maxQ < quantity) {
            available.style.color = 'red';
            addToCartBtn.classList.add('disabled');
            addToCartBtn.disabled = true;
        }
        if (minQ > quantity) {
            minqEl.style.color = 'red';
            addToCartBtn.classList.add('disabled');
            addToCartBtn.disabled = true;
        }

        let price = parseFloat(priceRub.dataset.value) || 0;
        const multiItems = priceRub.querySelectorAll('.multiPrice__item');

        if (multiItems.length > 0) {
            let bestPrice = null;
            let bestItem = null;
            multiItems.forEach(item => item.style.fontWeight = '');
            multiItems.forEach(item => {
                const qty = parseInt(item.querySelector('[data-multi="quantity"]').getAttribute('value'));
                const itemPrice = parseFloat(item.querySelector('[data-multi="price"]').getAttribute('value'));
                if (!isNaN(qty) && !isNaN(itemPrice) && qty <= quantity) {
                    bestPrice = itemPrice;
                    bestItem = item;
                }
            });
            if (bestItem) {
                bestItem.style.fontWeight = 'bold';
                price = bestPrice;
            }
        }

        const total = price * quantity;
        totalRub.dataset.value = total;
        totalRub.textContent = total.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' руб.';
    }

    // ============================================
    // ИНИЦИАЛИЗАЦИЯ КНОПОК КОРЗИНЫ
    // ============================================
    function initCartButtons() {
        document.querySelectorAll('.add-to-cart-btn').forEach(button => {
            button.removeEventListener('click', handleCartClick);
            button.addEventListener('click', handleCartClick);
        });
    }

    function handleCartClick() {
        const button = this;
        const row = button.closest('tr');
        const article = button.dataset.article;
        const name = button.dataset.name;
        const brand = button.dataset.brand;
        const term = button.dataset.term;
        const donor = button.dataset.donor;
        const minq = button.dataset.minq;
        const uid = button.dataset.uid;
        const rawPrice = button.dataset.price;
        const available = parseInt(button.dataset.available) || 0;

        let quantity = 1;
        const quantityInput = row.querySelector('.quantity-input');
        if (quantityInput) {
            quantity = parseInt(quantityInput.value) || 1;
        }

        button.disabled = true;

        postData(ajaxurl, {
            action: 'add_to_cart_verify',
            name: name,
            available: available,
            article: article,
            brand: brand,
            price: rawPrice,
            donor: donor,
            term: term,
            minq: minq,
            uid: uid
        })
            .then(response => {
                if (response.success) {
                    const verifiedPrice = response.data.verified_price;
                    executeAddToCartLogic(verifiedPrice, uid, article, name, brand, term, donor, available, quantity);
                } else {
                    alert('Ошибка безопасности: ' + (response.data?.message || response.message || 'неизвестная ошибка'));
                    console.error('Ошибка проверки товара:', response);
                }
            })
            .catch(error => {
                console.error('Ошибка запроса:', error);
                alert('Сетевая ошибка при проверке товара.\nДетали: ' + error.message);
            })
            .finally(() => {
                button.disabled = false;
            });
    }

    function executeAddToCartLogic(price, uid, article, name, brand, term, donor, available, quantity) {
        const currentPositions = parseInt(document.cookie.split('; ').find(row => row.startsWith('cart_count='))?.split('=')[1]) || 0;
        
        if (currentPositions >= 15) {
            alert('В корзине уже 15 позиций. Это максимальный лимит для одного заказа.');
            return;
        }

        postData(ajaxurl, {
            action: 'secure_add_to_cookie',
            product_data: {
                uid: uid,
                article: article,
                available: available,
                name: name,
                brand: brand,
                price: price,
                quantity: quantity,
                donor: donor,
                term: term
            }
        })
            .then(response => {
                if (response.success) {
                    const positionsCount = response.data.cart_count;
                    const scoreEl = document.querySelector('.product_score');
                    if (scoreEl) scoreEl.textContent = positionsCount;
                    
                    const headerCountEl = document.querySelector('.cart-item .cart-item_descr:last-child');
                    if (headerCountEl) {
                        headerCountEl.innerHTML = `<div class="product_score header">${positionsCount}</div>`;
                    }
                    
                    const formatNumber = (num) => parseFloat(num).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
                    alert(`Товар добавлен в защищенную корзину!\nНаименование: ${name}\nАртикул: ${article}\nКоличество: ${quantity} шт.\nЦена: ${formatNumber(price)} руб.`);
                } else {
                    alert('Ошибка при добавлении: ' + (response.data?.message || response.message || 'Неизвестная ошибка'));
                    console.error('Ошибка сервера:', response);
                }
            })
            .catch(error => {
                console.error('Ошибка запроса:', error);
                alert('Сетевая ошибка при сохранении корзины.\nДетали: ' + error.message);
            });
    }

    // ============================================
    // ЭКСПОРТ В EXCEL
    // ============================================
    function initExcelExport() {
        document.addEventListener('click', async (e) => {
            if (!e.target.matches('#exportToExcel')) return;
            
            const table = document.querySelector('.product-search-table');
            if (!table) return;

            if (typeof XLSX === 'undefined') {
                alert('Библиотека для экспорта не загружена. Попробуйте позже.');
                return;
            }

            const baseHeaders = Array.from(table.querySelectorAll('thead th'))
                .slice(0, -1)
                .filter(th => !th.classList.contains('quantity') && !th.textContent.toLowerCase().includes('кол'))
                .map(th => th.textContent.replace(/[^\w\sа-яёА-ЯЁ.,]/g, '').trim());

            const brandIndex = baseHeaders.findIndex(h => h.toLowerCase().includes('бренд'));
            const insertAt = brandIndex !== -1 ? brandIndex + 1 : 3;
            const extraHeaders = ["Кратность", "Норма уп.", "Минимум"];
            const headers = [...baseHeaders];
            headers.splice(insertAt, 0, ...extraHeaders);

            const data = [];
            table.querySelectorAll('tbody tr').forEach(tr => {
                const row = [];
                const folddivision = tr.querySelector(".folddivision")?.textContent.replace(/[^0-9]/g, '').trim() || "1";
                const sPack = tr.querySelector(".sPack")?.textContent.replace(/[^0-9]/g, '').trim() || "";
                const minq = tr.querySelector(".minq")?.textContent.replace(/[^0-9]/g, '').trim() || "1";
                const extras = [folddivision, sPack, minq];
                const multiItems = tr.querySelectorAll('.price-rub .multiPrice__item');

                tr.querySelectorAll('td').forEach((td, index) => {
                    if (td.classList.contains('quantity') || td.matches(':last-child')) return;

                    let cellValue = "";
                    if (td.classList.contains('price-rub')) {
                        if (multiItems.length > 0) {
                            cellValue = Array.from(multiItems).map(item => {
                                const qty = item.querySelector('[data-multi="quantity"]')?.getAttribute('value');
                                const prc = item.querySelector('[data-multi="price"]')?.getAttribute('value');
                                return qty && prc ? `от ${qty} шт. = ${prc.replace('.', ',')} руб.` : '';
                            }).filter(Boolean).join('\n');
                        } else {
                            const val = td.getAttribute('data-value');
                            cellValue = val ? val.replace('.', ',') : td.innerText.trim();
                        }
                    } else if (td.classList.contains('total-rub')) {
                        if (multiItems.length > 0) {
                            cellValue = Array.from(multiItems).map(item => {
                                const qty = item.querySelector('[data-multi="quantity"]')?.getAttribute('value');
                                const prc = item.querySelector('[data-multi="price"]')?.getAttribute('value');
                                if (qty && prc) {
                                    const total = (parseFloat(qty) * parseFloat(prc)).toFixed(2).replace('.', ',');
                                    return `${qty} шт. = ${total} руб.`;
                                }
                                return '';
                            }).filter(Boolean).join('\n');
                        } else {
                            cellValue = td.innerText.trim();
                        }
                    } else {
                        cellValue = td.innerText.replace(/\s+/g, ' ').trim();
                    }

                    row.push(cellValue);
                    if (row.length - 1 === brandIndex) {
                        row.push(...extras);
                    }
                });
                data.push(row);
            });

            const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
            ws['!cols'] = headers.map((h, i) => {
                if (i >= headers.length - 2) return { wch: 35 };
                if (extraHeaders.includes(h)) return { wch: 12 };
                if (h.toLowerCase().includes('наименование')) return { wch: 35 };
                if (h.toLowerCase().includes('поставщик')) return { wch: 20 };
                return { wch: 22 };
            });

            const range = XLSX.utils.decode_range(ws['!ref']);
            for (let R = range.s.r; R <= range.e.r; ++R) {
                for (let C = range.s.c; C <= range.e.c; ++C) {
                    const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
                    if (!ws[cellRef]) continue;
                    ws[cellRef].s = {
                        alignment: { vertical: "center", horizontal: "left", wrapText: true },
                        font: { name: "Arial", sz: 10 },
                        border: {
                            top: { style: "thin", color: { rgb: "D1D1D1" } },
                            bottom: { style: "thin", color: { rgb: "D1D1D1" } },
                            left: { style: "thin", color: { rgb: "D1D1D1" } },
                            right: { style: "thin", color: { rgb: "D1D1D1" } }
                        }
                    };
                    if (R === 0) {
                        ws[cellRef].s.fill = { fgColor: { rgb: "4472C4" } };
                        ws[cellRef].s.font = { color: { rgb: "FFFFFF" }, bold: true };
                        ws[cellRef].s.alignment.horizontal = "center";
                    } else {
                        if (extraHeaders.includes(headers[C])) {
                            ws[cellRef].s.alignment.horizontal = "center";
                        }
                    }
                    if (R > 0 && R % 2 === 0) {
                        ws[cellRef].s.fill = { fgColor: { rgb: "F9F9F9" } };
                    }
                }
            }

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Прайс");
            XLSX.writeFile(wb, "MegaAtom_Price.xlsx");
        });
    }

    // ============================================
    // КВОТА ЧЕКБОКСЫ
    // ============================================
    document.addEventListener('change', (event) => {
        if (event.target?.classList.contains('quote-checkbox')) {
            const allCheckboxes = document.querySelectorAll('.quote-checkbox');
            const checkedBoxes = Array.from(allCheckboxes).filter(checkbox => checkbox.checked);
            const count = checkedBoxes.length;
            const quoteBtns = document.querySelectorAll('.qutaBtn');

            if (count > 0) {
                quoteBtns.forEach(btn => btn.classList.add('active'));
            } else {
                quoteBtns.forEach(btn => btn.classList.remove('active'));
            }
        }
    });

    // ============================================
    // МОДАЛЬНОЕ ОКНО ЗАПРОСА КВОТЫ
    // ============================================
    document.addEventListener('click', (event) => {
        const openBtn = event.target.closest('.qutaBtn.active');
        if (openBtn) {
            const selectedProducts = [];
            const checkedBoxes = document.querySelectorAll('.quote-checkbox:checked');
            checkedBoxes.forEach(checkbox => {
                const row = checkbox.closest('tr');
                selectedProducts.push({
                    article: row.querySelector('.product-name')?.innerText.trim() || '',
                    brand: row.querySelector('.brand')?.innerText.trim() || '',
                    qty: row.querySelector('.quantity-input')?.value || 1
                });
            });
            if (selectedProducts.length > 0) {
                openGemQuoteModal(selectedProducts);
            }
            return;
        }

        if (event.target.classList.contains('gem-quote-overlay') || event.target.classList.contains('gem-quote-close')) {
            const modal = document.querySelector('.gem-quote-overlay');
            if (modal) modal.remove();
            return;
        }

        if (event.target.classList.contains('gem-quote-remove-row')) {
            const row = event.target.closest('.gem-quote-row');
            const container = row.parentElement;
            row.remove();
            if (container.children.length === 0) {
                document.querySelector('.gem-quote-overlay')?.remove();
            }
        }
    });

    function openGemQuoteModal(products) {
        const rowsHtml = products.map((p, index) => {
            const showTitle = index === 0 ? '' : 'style="display: none;"';
            return `
            <div class="gem-quote-row" data-index="${index}">
                <div class="gem-quote-field">
                    <div class="gem-quote__input-title" ${showTitle}>Партномер<span class="required">*</span></div>
                    <input type="text" name="products[${index}][article]" value="${p.article}" placeholder="Напр: MAX3488" required>
                </div>
                <div class="gem-quote-field">
                    <div class="gem-quote__input-title" ${showTitle}>Производитель<span class="required">*</span></div>
                    <input type="text" name="products[${index}][brand]" value="${p.brand}" placeholder="Напр: Analog Devices" required>
                </div>
                <div class="gem-quote-field gem-quote-qty">
                    <div class="gem-quote__input-title" ${showTitle}>Кол-во<span class="required">*</span></div>
                    <input type="number" name="products[${index}][qty]" value="${p.qty}" min="1" required>
                </div>
                <div class="gem-quote-field">
                    <div class="gem-quote__input-title" ${showTitle}>Желаемая цена<span class="required">*</span></div>
                    <input type="text" name="products[${index}][target_price]" placeholder="Цена" required>
                </div>
                <div class="gem-quote-field">
                    <div class="gem-quote__input-title" ${showTitle}>Доставка<span class="required">*</span></div>
                    <select name="products[${index}][delivery_term]" required>
                        <option value="" disabled>Выберите срок...</option>
                        <option value="5_weeks">Не более 5 недель</option>
                        <option value="6_weeks">Не более 6 недель</option>
                        <option value="12_weeks">Не более 12 недель</option>
                        <option value="26_weeks">Не более 26 недель</option>
                        <option value="52_weeks">Не более 52-х недель</option>
                        <option value="urgent">Срочно</option>
                    </select>
                </div>
                <button type="button" class="gem-quote-remove-row" title="Удалить" ${index === 0 ? 'style="margin-top: 24px;"' : ''}>✕</button>
            </div>
            `;
        }).join('');

        const modalHtml = `
            <div class="gem-quote-overlay">
                <div class="gem-quote-modal">
                    <h2 class="gem-quote-title">Запрос квоты</h2>
                    <form id="gem-quote-form" class="gem-quote-form-container">
                        <input type="hidden" name="action" value="submit_gem_quote">
                        
                        <div class="gem-quote-body">
                            <div class="gem-quote-field gem-quote-full-width">
                                <div class="gem-quote__input-title">Компания<span class="required">*</span></div>
                                <input name="company_name" class="gem-quote-company-input" required>
                            </div>
                            <div class="gem-quote-products-list">
                                ${rowsHtml}
                            </div>
                            <div class="gem-quote-submit-wrapper">
                                <div class="gem-quote-field gem-quote-descr-width">
                                    <div class="gem-quote__input-descr">Ваш комментарий к заявке (не обязательно)</div>
                                    <textarea name="user_comment" rows="3" placeholder="Ваш комментарий"></textarea>
                                </div>
                                <div class="gem-quote-footer">
                                    <label class="gem-quote-checkbox-label">
                                        <div class="gem-quote-info-wrapper">
                                            <input name="only_official" class="gem-quote-checkbox" type="checkbox" value="1">
                                            <div class="gem-quote-info">Рассматривать только официальных дистрибьютеров и магазины производителей</div>
                                            <div class="gem-quote-submit-info" style="cursor:pointer">ⓘ</div>
                                        </div>
                                    </label>
                                    <div class="gem-quote-submit-wrapper">
                                        <button type="submit" class="gem-quote-final-btn">Запросить квоту</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    // ============================================
    // ОТПРАВКА ФОРМЫ КВОТЫ
    // ============================================
    document.addEventListener('submit', async (e) => {
        if (e.target?.id === 'gem-quote-form') {
            e.preventDefault();
            const form = e.target;
            const formData = new FormData(form);
            const btn = form.querySelector('.gem-quote-final-btn');
            
            btn.disabled = true;
            btn.innerText = 'Отправка...';

            const actionUrl = window.gem_quote_data?.ajax_url || '/wp-admin/admin-ajax.php';
            
            try {
                const response = await fetch(actionUrl, {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();
                
                if (data.success) {
                    showSuccessModal();
                    setTimeout(() => {
                        const overlay = document.querySelector('.gem-quote-overlay');
                        if (overlay) overlay.remove();
                    }, 500);
                } else {
                    showGemToast('❌ ' + data.message, 'error');
                    btn.disabled = false;
                    btn.innerText = 'Запросить квоту';
                }
            } catch (error) {
                showGemToast('❌ Ошибка связи с сервером', 'error');
                btn.disabled = false;
                btn.innerText = 'Запросить квоту';
            }
        }
    });

    function showGemToast(message, type) {
        const toast = document.createElement('div');
        toast.className = `gem-toast gem-toast-${type}`;
        toast.innerText = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 100);
    }

    // ============================================
    // ИНФО МОДАЛЬНОЕ ОКНО
    // ============================================
    document.addEventListener('click', (e) => {
        if (e.target.closest('.gem-quote-submit-info') || e.target.closest('.gem-quote-checkbox-label span')) {
            e.preventDefault();
            e.stopPropagation();
            
            const infoModalHtml = `
            <div class="gem-info-overlay">
                <div class="gem-info-modal">
                    <h3 class="gem-info-title">Официальные дистрибьюторы</h3>
                    <p class="gem-info-descr">Устанавливая этот пункт, вы ограничиваете поиск лишь официальными дистрибьютерами</p>
                    <button class="gem-info-cancel-btn">Закрыть</button>
                </div>
            </div>
            `;
            document.body.insertAdjacentHTML('beforeend', infoModalHtml);
        }

        if (e.target.closest('.gem-info-cancel-btn') || e.target.classList.contains('gem-info-overlay')) {
            const overlay = document.querySelector('.gem-info-overlay');
            if (overlay) overlay.remove();
        }
    });

    initQuantityInputs();
    initCartButtons();
    initExcelExport();
}

// ============================================
// ЗАГРУЗКА XLSX БИБЛИОТЕКИ
// ============================================
function loadXLSXLibrary(callback) {
    if (typeof XLSX !== 'undefined') {
        callback();
        return;
    }
    
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js";
    script.onload = callback;
    document.head.appendChild(script);
}

// ============================================
// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ POST ЗАПРОСОВ
// ============================================
function postData(url, data) {
    const params = new URLSearchParams();
    
    // Рекурсивная функция для развертывания вложенных объектов
    const flattenObject = (obj, prefix = '') => {
        for (const [key, value] of Object.entries(obj)) {
            const newKey = prefix ? `${prefix}[${key}]` : key;
            
            if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                flattenObject(value, newKey);
            } else if (Array.isArray(value)) {
                value.forEach((item, index) => {
                    const arrayKey = `${newKey}[${index}]`;
                    if (item !== null && typeof item === 'object') {
                        flattenObject(item, arrayKey);
                    } else {
                        params.append(arrayKey, item);
                    }
                });
            } else {
                params.append(newKey, value);
            }
        }
    };
    
    flattenObject(data);
    
    return fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
    })
    .catch(error => {
        console.error('AJAX Error:', error, 'URL:', url, 'Data:', data);
        throw error;
    });
}

// ============================================
// ЗАПУСК ИНИЦИАЛИЗАЦИИ
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    if (typeof window.megaatom_ajax_object !== 'undefined') {
        loadXLSXLibrary(initProductSearch);
    }
});
