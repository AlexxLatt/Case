<?php
if (!defined('ABSPATH')) {
    exit;
}

// 1. Константы (в wp-config.php лучше)
if (!defined('COOKIE_ENCRYPTION_KEY')) {
    define('COOKIE_ENCRYPTION_KEY', 'ваша-секретная-строка-32-знака!!!');
}
define('ENCRYPTION_METHOD', 'aes-256-cbc');

// 2. Функции шифрования
function secure_cookie_pack($data) {
    $iv = openssl_random_pseudo_bytes(openssl_cipher_iv_length(ENCRYPTION_METHOD));
    $encrypted = openssl_encrypt(json_encode($data), ENCRYPTION_METHOD, COOKIE_ENCRYPTION_KEY, 0, $iv);
    return base64_encode($iv . $encrypted);
}

// 3. САМ ОБРАБОТЧИК AJAX
add_action('wp_ajax_add_to_cart_secure', 'handle_add_to_cart_secure');
add_action('wp_ajax_nopriv_add_to_cart_secure', 'handle_add_to_cart_secure');

function handle_add_to_cart_secure() {
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }

    $uid = $_POST['uid'] ?? '';
    $user_price = floatval($_POST['price'] ?? 0);
    $available = $_POST['available'] ?? '';
    $qty = intval($_POST['quantity'] ?? 1);
    
    // === ПРОВЕРКА UID ===
    if (!isset($_SESSION['valid_product_uids'][$uid])) {
        wp_send_json_error(['message' => 'Товар не найден или сессия истекла']);
    }
    
    $original_price = $_SESSION['valid_product_uids'][$uid];
    
    // Проверяем, не подменил ли юзер цену в HTML
    if (abs($original_price - $user_price) > 0.01) {
        wp_send_json_error(['message' => 'Ошибка валидации цены. Цена товара изменилась или была подменена.']);
    }
    
    // === ПОЛУЧАЕМ КОРЗИНУ ===
    $cart = [];
    if (!empty($_COOKIE['simple_cart'])) {
        $raw = base64_decode($_COOKIE['simple_cart']);
        $iv_len = openssl_cipher_iv_length(ENCRYPTION_METHOD);
        $iv = substr($raw, 0, $iv_len);
        $cipher = substr($raw, $iv_len);
        $decrypted = openssl_decrypt($cipher, ENCRYPTION_METHOD, COOKIE_ENCRYPTION_KEY, 0, $iv);
        $cart = json_decode($decrypted, true) ?: [];
    }
    
    // === ДОБАВЛЯЕМ ТОВАР ===
    $cart[] = [
        'article'  => sanitize_text_field($_POST['article']),
        'name'     => sanitize_text_field($_POST['name']),
        'brand'    => sanitize_text_field($_POST['brand']),
        'available'=> $available,
        'price'    => $original_price,
        'quantity' => $qty,
        'uid'      => $uid
    ];
    
    // === ШИФРУЕМ И СОХРАНЯЕМ ===
    $iv = openssl_random_pseudo_bytes(openssl_cipher_iv_length(ENCRYPTION_METHOD));
    $encrypted = openssl_encrypt(json_encode($cart), ENCRYPTION_METHOD, COOKIE_ENCRYPTION_KEY, 0, $iv);
    $secure_cart = base64_encode($iv . $encrypted);
    
    // Счётчик товаров (тоже шифруем)
    $count = count($cart);
    $iv_count = openssl_random_pseudo_bytes(openssl_cipher_iv_length(ENCRYPTION_METHOD));
    $encrypted_count = openssl_encrypt(json_encode($count), ENCRYPTION_METHOD, COOKIE_ENCRYPTION_KEY, 0, $iv_count);
    $secure_count = base64_encode($iv_count . $encrypted_count);
    
    $expiry = time() + (7 * DAY_IN_SECONDS);
    
    setcookie('simple_cart', $secure_cart, $expiry, COOKIEPATH, COOKIE_DOMAIN, true, true);
    setcookie('cart_count', $secure_count, $expiry, COOKIEPATH, COOKIE_DOMAIN, true, false);
    
    wp_send_json_success(['cart_count' => $count]);
}

add_action('wp_ajax_add_to_cart_verify', 'add_to_cart_verify_handler');
add_action('wp_ajax_nopriv_add_to_cart_verify', 'add_to_cart_verify_handler');
    
function add_to_cart_verify_handler() {
        if (ob_get_length()) ob_clean();

        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        $upload_dir = wp_upload_dir();
        $log_file = $upload_dir['basedir'] . '/cart_debug.log';
        $log_time = date('Y-m-d H:i:s');
        
        // --- ПОДГОТОВКА ДАННЫХ ---
        $client_uid = $_POST['uid'] ?? 'MISSING';
        $name    	= $_POST['name'] ?? '';
        $article    = $_POST['article'] ?? '';
        $brand      = $_POST['brand'] ?? '';
        $price_raw  = $_POST['price'] ?? '0';
        $donor      = $_POST['donor'] ?? '';
        $term       = $_POST['term'] ?? '';
        $minq       = $_POST['minq'] ?? '';
        $available  = $_POST['available'] ?? '';
        $secret_key = defined('CART_SIGNATURE_KEY') ? CART_SIGNATURE_KEY : 'default_salt_99';
        $price_fixed = number_format((float)$price_raw, 2, '.', '');

        // Формируем строку строго по порядку: Артикул | Бренд | Цена | Донор | Срок | Мин_заказ
        $signature_string = $name . '|' . $available . '|' . $article . '|' . $brand . '|' . $price_fixed . '|' . $donor . '|' . $term . '|' . $minq;
        $server_uid = hash_hmac('sha256', $signature_string, $secret_key);

        // --- ФОРМИРОВАНИЕ ПОЛНОГО ЛОГА ---
        $out = "====================================================\n";
        $out .= "[$log_time] НОВЫЙ AJAX ЗАПРОС\n";
        $out .= "--- ВХОДЯЩИЕ ИЗ POST ---\n";
        $out .= "Name:   	$name\n";
        $out .= "Available: $available\n";
        $out .= "Article:   $article\n";
        $out .= "Brand:     $brand\n";
        $out .= "Price Raw: $price_raw -> Fixed: $price_fixed\n";
        $out .= "Donor:     $donor\n";
        $out .= "Term:      $term\n";
        $out .= "MinQ:      $minq\n";
        $out .= "--- СРАВНЕНИЕ UID ---\n";
        $out .= "Client UID: $client_uid\n";
        $out .= "Server UID: $server_uid\n";
        $out .= "String used: [$signature_string]\n";
        
        // Проверка совпадения UID
        if ($client_uid !== $server_uid) {
            $out .= "!!! РЕЗУЛЬТАТ: ОШИБКА ХЕША (Данные не совпадают с подписью)\n";
            file_put_contents($log_file, $out, FILE_APPEND);
            wp_send_json_error(['message' => 'Ошибка безопасности (UID mismatch).']);
            exit;
        }

        // Проверка Сессии
        $out .= "--- ПРОВЕРКА СЕССИИ ---\n";
        if (!isset($_SESSION['valid_product_uids'])) {
            $out .= "!!! РЕЗУЛЬТАТ: СЕССИЯ 'valid_product_uids' ВООБЩЕ ПУСТАЯ\n";
        } elseif (!isset($_SESSION['valid_product_uids'][$server_uid])) {
            $out .= "!!! РЕЗУЛЬТАТ: UID НЕ НАЙДЕН В СЕССИИ\n";
            $out .= "Доступные ключи в сессии (первые 3): " . implode(', ', array_slice(array_keys($_SESSION['valid_product_uids']), 0, 3)) . "...\n";
        } else {
            $session_price = $_SESSION['valid_product_uids'][$server_uid];
            $out .= "+++ РЕЗУЛЬТАТ: УСПЕХ (Цена в сессии: $session_price)\n";
            file_put_contents($log_file, $out, FILE_APPEND);
            wp_send_json_success(['verified_price' => floatval($session_price)]);
            exit;
        }

        file_put_contents($log_file, $out, FILE_APPEND);
        wp_send_json_error(['message' => 'Товар не найден или сессия истекла.']);
        exit;
}
add_action('wp_ajax_secure_add_to_cookie', 'handle_secure_add_to_cookie');
add_action('wp_ajax_nopriv_secure_add_to_cookie', 'handle_secure_add_to_cookie');

function handle_secure_add_to_cookie() {
    $product = $_POST['product_data'] ?? null;
    if (!$product) wp_send_json_error(['message' => 'Нет данных']);

    $secret_key = defined('CART_SIGNATURE_KEY') ? CART_SIGNATURE_KEY : 'default_salt_99';
    
    // 1. Получаем текущую корзину
    $cart = [];
    if (!empty($_COOKIE['simple_cart'])) {
        $decrypted = openssl_decrypt(base64_decode($_COOKIE['simple_cart']), 'AES-128-ECB', $secret_key);
        if ($decrypted) {
            $uncompressed = @gzuncompress($decrypted);
            if ($uncompressed) {
                $cart = json_decode($uncompressed, true) ?: [];
            }
        }
    }

    // --- ЛОГИКА ПРОВЕРКИ UID И AVAILABLE ---
    $new_uid = $product['uid'] ?? '';
    $new_quantity = intval($product['quantity']);
    $available_limit = intval($product['available'] ?? 0);
    
    $found_key = false;
    foreach ($cart as $key => $item) {
        if ($item['uid'] === $new_uid) {
            // Проверяем: текущее в корзине + новое > лимита?
            if (($item['quantity'] + $new_quantity) > $available_limit) {
                wp_send_json_error([
                    'message' => "Лимит превышен! Доступно всего: $available_limit шт. У вас в корзине уже есть {$item['quantity']} шт."
                ]);
                exit;
            }
            
            // Если проверка прошла, обновляем существующую позицию
            $cart[$key]['quantity'] += $new_quantity;
            $cart[$key]['total'] = $cart[$key]['quantity'] * $cart[$key]['price'];
            $found_key = true;
            break;
        }
    }

    // 2. Если товар новый (не найден по UID), проверяем лимит позиций и добавляем
    if (!$found_key) {
        if (count($cart) >= 15) {
            wp_send_json_error(['message' => 'Максимум 15 различных позиций в корзине']);
            exit;
        }

        // Проверяем доступность даже для первой добавки
        if ($new_quantity > $available_limit) {
            wp_send_json_error(['message' => "Недостаточно товара! Доступно: $available_limit шт."]);
            exit;
        }

        $cart[] = [
            'uid'      => $new_uid,
            'available'=> $available_limit,
            'article'  => sanitize_text_field($product['article']),
            'name'     => sanitize_text_field($product['name']),
            'brand'    => sanitize_text_field($product['brand']),
            'price'    => floatval($product['price']),
            'quantity' => $new_quantity,
            'donor'    => sanitize_text_field($product['donor']),
            'term'     => sanitize_text_field($product['term']),
            'total'    => floatval($product['price']) * $new_quantity
        ];
    }

    // 4. Упаковка: JSON -> Сжатие -> Шифрование -> Base64
    $json_data = json_encode($cart);
    $compressed = gzcompress($json_data, 9); 
    $encrypted = base64_encode(openssl_encrypt($compressed, 'AES-128-ECB', $secret_key));

    // 5. Устанавливаем куки (на 1 день)
    $expiry = time() + (1 * DAY_IN_SECONDS);
    setcookie('simple_cart', $encrypted, $expiry, COOKIEPATH, COOKIE_DOMAIN, false, false);
    
    // Считаем общее количество штук (Quantity) для иконки корзины

    if (!empty($_COOKIE['cart_count'])) {
        $raw_count = $_COOKIE['cart_count'];

        // Если в куке хранится простой числовой счетчик — используем его напрямую
        if (is_numeric($raw_count)) {
            $existing = intval($raw_count);
        } else {
            // Иначе пытаемся корректно расшифровать старый формат
            $existing = 0;
            $decoded = base64_decode($raw_count, true);
            if ($decoded !== false) {
                $decrypted_count = openssl_decrypt($decoded, 'AES-128-ECB', $secret_key);
                if ($decrypted_count !== false) {
                    $maybe = json_decode($decrypted_count, true);
                    $existing = intval($maybe);
                }
            }
        }

        $total_items_count = $existing + 1;
    } else {
        $total_items_count = 1;
    }

    // Записываем как простой числовой счетчик — проще и безопаснее для фронтенда
    setcookie('cart_count', $total_items_count, $expiry, COOKIEPATH, COOKIE_DOMAIN, false, false);

    wp_send_json_success(['cart_count' => $total_items_count]);
}


add_action('wp_ajax_secure_remove_from_cart', 'handle_secure_remove_from_cart');
add_action('wp_ajax_nopriv_secure_remove_from_cart', 'handle_secure_remove_from_cart');

function handle_secure_remove_from_cart() {
        $index = isset($_POST['item_index']) ? intval($_POST['item_index']) : -1;
        $secret_key = defined('CART_SIGNATURE_KEY') ? CART_SIGNATURE_KEY : 'default_salt_99';

        if ($index < 0 || empty($_COOKIE['simple_cart'])) {
            wp_send_json_error(['message' => 'Некорректные данные или корзина пуста']);
        }

        // 1. Расшифровываем и РАЗЖИМАЕМ корзину
        $cart = [];
        $decrypted = openssl_decrypt(base64_decode($_COOKIE['simple_cart']), 'AES-128-ECB', $secret_key);
        if ($decrypted) {
            $uncompressed = @gzuncompress($decrypted); // Сначала разжимаем
            if ($uncompressed) {
                $cart = json_decode($uncompressed, true) ?: []; // Потом декодируем
            }
        }

        // 2. Удаляем элемент
        if (isset($cart[$index])) {
            array_splice($cart, $index, 1);
        }

        // 3. Шифруем и СЖИМАЕМ обратно
        $expiry = time() + (1 * DAY_IN_SECONDS);
        if (empty($cart)) {
            setcookie('simple_cart', '', time() - 3600, COOKIEPATH, COOKIE_DOMAIN);
            setcookie('cart_count', '0', time() - 3600, COOKIEPATH, COOKIE_DOMAIN);
        } else {
            $json_data = json_encode($cart);
            $compressed = gzcompress($json_data, 9); // Сжимаем данные
            $encrypted = base64_encode(openssl_encrypt($compressed, 'AES-128-ECB', $secret_key));
            
            setcookie('simple_cart', $encrypted, $expiry, COOKIEPATH, COOKIE_DOMAIN, false, false);
            setcookie('cart_count', count($cart), $expiry, COOKIEPATH, COOKIE_DOMAIN, false, false);
        }

        wp_send_json_success();
}
