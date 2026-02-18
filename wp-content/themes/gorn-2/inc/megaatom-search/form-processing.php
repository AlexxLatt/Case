<?php
/**
 * Регистрация хуков для обработки заказа
 */
add_action('admin_post_submit_custom_order', 'handle_custom_order_submission');
add_action('admin_post_nopriv_submit_custom_order', 'handle_custom_order_submission');

/**
 * Обработчик отправки заказа
 */
function handle_custom_order_submission() {
    // Проверка метода запроса
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        wp_redirect(home_url('/'));
        exit;
    }

    // Проверка nonce
    if (!wp_verify_nonce($_POST['order_nonce'] ?? '', 'submit_order')) {
        wp_redirect(home_url('/?error=security'));
        exit;
    }

    /** * 1. ОБРАБОТКА И ВАЛИДАЦИЯ ДАННЫХ
     */

    // Убираем лишние слеши (эффект Magic Quotes) и очищаем поля
    $name    = sanitize_text_field(stripslashes($_POST['name'] ?? ''));
    $email   = sanitize_text_field(stripslashes($_POST['email'] ?? ''));
    $company = sanitize_text_field(stripslashes($_POST['company'] ?? ''));
    $comment = sanitize_textarea_field(stripslashes($_POST['comment'] ?? ''));

    // Валидация телефона (только +7 и цифры, макс 12 символов)
    $phone_raw = sanitize_text_field($_POST['phone'] ?? '');
    $phone = preg_replace('/[^\d+]/', '', $phone_raw); // Удаляем всё, кроме цифр и +
    if (strpos($phone, '8') === 0 && strlen($phone) === 11) {
        $phone = '+7' . substr($phone, 1); // Замена 8 на +7
    }
    $phone = mb_substr($phone, 0, 12); // Обрезаем до лимита БД

    // Валидация ИНН (только цифры, макс 12 символов)
    $inn = preg_replace('/\D/', '', $_POST['inn'] ?? '');
    $inn = mb_substr($inn, 0, 12);

    if (empty($name) || empty($phone) || empty($email)) {
        wp_redirect(home_url('/?error=required'));
        exit;
    }

    /** * 2. РАБОТА С КОРЗИНОЙ
     */
    $secret_key = defined('CART_SIGNATURE_KEY') ? CART_SIGNATURE_KEY : 'default_salt_99';
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

    if (empty($cart)) {
        wp_redirect(home_url('/?error=empty_cart'));
        exit;
    }

    $cart_data = json_encode($cart, JSON_UNESCAPED_UNICODE);

    $donors = [];
    $terms  = [];
    foreach ($cart as $item) {
        if (!empty($item['donor'])) $donors[] = $item['donor'];
        if (!empty($item['term']))  $terms[]  = $item['term'];
    }

    // Готовим строки для БД (обрезаем длину для безопасности, если поля не TEXT)
    $donor_str = mb_substr(implode('; ', array_unique($donors)), 0, 255);
    $term_str  = mb_substr(implode('; ', array_unique($terms)), 0, 255);

    /** * 3. СОХРАНЕНИЕ В БД
     */
    global $wpdb;
    $table = $wpdb->prefix . 'custom_orders';

    $result = $wpdb->insert(
        $table,
        [
            'name'      => $name,
            'phone'     => $phone,
            'email'     => $email,
            'company'   => $company,
            'donor'     => $donor_str,
            'term'      => $term_str,
            'inn'       => $inn,
            'comment'   => $comment,
            'cart_data' => $cart_data,
        ],
        ['%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s']
    );

    /** * 4. ОТПРАВКА ПИСЕМ
     */
    if ($result !== false) {
        $order_id = $wpdb->insert_id;
        $site_name = get_bloginfo('name');
        $order_date = date('d.m.Y');
        
        $subject = sprintf('Оформление заказа №%d', $order_id);
        $subjectUser = sprintf('Ваша заявка №%d от %s принята в работу.', $order_id, $order_date);

        // Таблица товаров для письма
        $cart_table = '';
        if (!empty($cart)) {
            $cart_table = '<h3>Товары в заказе:</h3><table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">';
            $cart_table .= '<thead><tr><th>Наименование</th><th>Поставщик</th><th>Бренд</th><th>Цена</th><th>Срок</th><th>Кол-во</th><th>Сумма</th></tr></thead><tbody>';

            foreach ($cart as $item) {
                $nameA   = esc_html($item['name'] ?? '—');
                $donor   = esc_html($item['donor'] ?? '—');
                $brand   = esc_html($item['brand'] ?? '—');
                $price   = number_format($item['price'] ?? 0, 2, ',', ' ');
                $term    = esc_html($item['term'] ?? '—');
                $qty     = (int)($item['quantity'] ?? 0);
                $total   = number_format($item['total'] ?? 0, 2, ',', ' ');
            
                $cart_table .= "<tr><td>{$nameA}</td><td>{$donor}</td><td>{$brand}</td><td>{$price} ₽</td><td>{$term}</td><td>{$qty}</td><td>{$total} ₽</td></tr>";
            }
            $cart_table .= '</tbody></table>';
        }

        $message = "
            <div style='padding:20px; font-family: sans-serif;'>
                <p><strong>ФИО:</strong> {$name}</p>
                <p><strong>Телефон:</strong> {$phone}</p>
                <p><strong>Компания:</strong> {$company}</p>
                <p><strong>ИНН:</strong> {$inn}</p>
                <p><strong>Комментарий:</strong><br>{$comment}</p>
                {$cart_table}
            </div>";
        
        $messageUser = "
            <div style='font-family: sans-serif;'>
                <p>Ваша заявка №{$order_id} от {$order_date} принята в работу.</p>
                <p>В ближайшее время Вам будет выставлен счет на оплату.</p>
                <p>Благодарим за доверие!</p>
            </div>";
        
        $headers = [
            'Content-Type: text/html; charset=UTF-8',
            'From: ' . $site_name . ' <info@megaatom.com>'
        ];
        //wp_mail("info@megaatom.com", $subject, $message, $headers);
        //wp_mail($email, $subjectUser, $messageUser, $headers);
        wp_mail("a.latipov@itgrade.ru", $subject, $message, $headers);

        // Очищаем куки
        setcookie('simple_cart', '', time() - 3600, '/');
        setcookie('cart_count', '', time() - 3600, '/');

        wp_redirect(home_url('/thank-you/?order_id=' . $order_id));
        exit;
    } else {
        wp_redirect(home_url('/?error=db'));
        exit;
    }
}

add_action('wp_ajax_submit_component_request', 'handle_component_request');
add_action('wp_ajax_nopriv_submit_component_request', 'handle_component_request');

/**
 * Обработчик запроса компонентов
 */
function handle_component_request() {
    // Устанавливаем заголовки JSON
    header('Content-Type: application/json; charset=utf-8');

    // Проверка nonce
    if (!isset($_POST['component_nonce']) || !wp_verify_nonce($_POST['component_nonce'], 'component_request')) {
        echo json_encode([
            'success' => false,
            'data' => 'Ошибка безопасности. Попробуйте обновить страницу.'
        ]);
        exit;
    }

    // Получаем и очищаем данные
    $title         = sanitize_text_field(trim($_POST['title'] ?? ''));
    $brand         = sanitize_text_field(trim($_POST['brand'] ?? ''));
    $quantity      = absint($_POST['quantity'] ?? 1);
    $price         = isset($_POST['price']) ? floatval($_POST['price']) : null;
    $delivery_time = sanitize_text_field($_POST['delivery_time'] ?? '');
    $company       = sanitize_text_field(trim($_POST['company'] ?? ''));
    $comment       = sanitize_textarea_field(trim($_POST['comment'] ?? ''));

    // Простая валидация
    if (empty($title) || empty($brand) || empty($company) || empty($delivery_time)) {
        echo json_encode([
            'success' => false,
            'data' => 'Заполните все обязательные поля.'
        ]);
        exit;
    }

    // Преобразуем срок
    if ($delivery_time === 'up_to_5_weeks') {
        $delivery_label = 'не более 5 недель';
    } elseif ($delivery_time === 'more_than_5_weeks') {
        $delivery_label = 'более 5 недель';
    } else {
        $delivery_label = $delivery_time;
    }

    // Формируем письмо
    $message = "Новый запрос на квотирование\n\n";
    $message .= "Артикул: $title\n";
    $message .= "Бренд: $brand\n";
    $message .= "Количество: $quantity шт.\n";
    if ($price !== null) {
        $message .= "Цена: " . number_format($price, 2, ',', ' ') . " руб.\n";
    }
    $message .= "Срок поставки: $delivery_label\n";
    $message .= "Компания: $company\n";
    if ($comment) {
        $message .= "Комментарий: $comment\n";
    }

    // Отправляем
    $to      = 'a.latipov@itgrade.ru';
    $subject = 'Запрос квоты: ' . $title;

    $sent = wp_mail($to, $subject, $message, [
        'Content-Type: text/plain; charset=UTF-8',
        'From: MegaAtom <no-reply@megaatom.com>'
    ]);

    if ($sent) {
        echo json_encode([
            'success' => true,
            'data' => 'Запрос на квотирование успешно отправлен.'
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'data' => 'Не удалось отправить письмо.'
        ]);
    }
    
    exit;
}


add_action('wp_ajax_submit_gem_quote', 'handle_gem_quote_submission');
add_action('wp_ajax_nopriv_submit_gem_quote', 'handle_gem_quote_submission');

/**
 * Обработчик формы запроса квоты
 */
function handle_gem_quote_submission() {
    // Устанавливаем заголовки JSON
    header('Content-Type: application/json; charset=utf-8');

    // 1. Получаем и очищаем основные данные
    $company = sanitize_text_field($_POST['company_name'] ?? '');
    $comment = isset($_POST['user_comment']) ? sanitize_textarea_field($_POST['user_comment']) : '—';
    $only_official = isset($_POST['only_official']) ? 'ДА' : 'НЕТ';
    $products = isset($_POST['products']) ? $_POST['products'] : [];

    // Валидация обязательных полей
    if (empty($company) || empty($products)) {
        echo json_encode([
            'success' => false,
            'message' => 'Заполните все обязательные поля.'
        ]);
        exit;
    }

    // 2. Формируем тему письма
    $subject = "Новый запрос квоты от компании: " . $company;

    // 3. Формируем тело письма (HTML Таблица)
    $message = "
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .header { background: #f4f4f4; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            th { background-color: #ff5e14; color: white; }
            .footer { font-size: 12px; color: #777; margin-top: 30px; }
            .label { font-weight: bold; color: #555; }
        </style>
    </head>
    <body>
        <div class='header'>
            <h2>Запрос квоты</h2>
            <p><span class='label'>Компания:</span> {$company}</p>
            <p><span class='label'>Только официалы:</span> {$only_official}</p>
        </div>

        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Партномер</th>
                    <th>Производитель</th>
                    <th>Кол-во</th>
                    <th>Желаемая цена</th>
                    <th>Срок доставки</th>
                </tr>
            </thead>
            <tbody>";

    // 4. Проходим по массиву товаров и добавляем строки
    if (!empty($products) && is_array($products)) {
        foreach ($products as $index => $p) {
            $num = $index + 1;
            $article = esc_html($p['article'] ?? '—');
            $brand = esc_html($p['brand'] ?? '—');
            $qty = esc_html($p['qty'] ?? '0');
            $price = esc_html($p['target_price'] ?? '—');
            $term = esc_html($p['delivery_term'] ?? '—');

            $message .= "
                <tr>
                    <td>{$num}</td>
                    <td><b>{$article}</b></td>
                    <td>{$brand}</td>
                    <td>{$qty} шт.</td>
                    <td>{$price}</td>
                    <td>{$term}</td>
                </tr>";
        }
    } else {
        $message .= "<tr><td colspan='6' style='text-align:center;'>Товары не выбраны</td></tr>";
    }

    $message .= "
            </tbody>
        </table>

        <div class='header'>
            <p><span class='label'>Комментарий заказчика:</span><br>{$comment}</p>
        </div>

        <div class='footer'>
            <p>Письмо отправлено автоматически с формы 'Запрос квоты'. Дата: " . date('d.m.Y H:i') . "</p>
        </div>
    </body>
    </html>";

    // 5. Отправляем письмо через wp_mail
    $to = "a.latipov@itgrade.ru";
    $headers = [
        'Content-Type: text/html; charset=UTF-8',
        'From: Megaatom <info@megaatom.com>'
    ];

    $sent = wp_mail($to, $subject, $message, $headers);

    if ($sent) {
        echo json_encode([
            'success' => true,
            'message' => 'Запрос успешно отправлен!'
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'Ошибка при отправке почты.'
        ]);
    }
    
    exit;
}