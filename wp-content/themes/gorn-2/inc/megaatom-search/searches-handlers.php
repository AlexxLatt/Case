<?php
if (!defined('ABSPATH')) {
    exit;
}

use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Reader\Exception as ReaderException;

// === AJAX-обработчики ===
add_action('wp_ajax_nopriv_product_search_by_article', 'handle_product_search_by_article');
add_action('wp_ajax_product_search_by_article', 'handle_product_search_by_article');
function handle_product_search_by_article() {
    $input = sanitize_textarea_field($_POST['article'] ?? '');
    if (empty(trim($input))) {
        wp_send_json_error('Пустой запрос');
    }
    
    $original_articles = [];
    $input_clean = trim(str_replace(["\r\n", "\r"], "\n", $input));
    if ($input_clean !== '') {
        $lines = explode("\n", $input_clean);
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '') continue;
            if (strpos($line, ':') !== false) {
                $parts = explode(':', $line, 2);
                $article = trim($parts[0]);
                $qty = max(1, (int) trim($parts[1]));
            } else {
                $article = $line;
                $qty = 1;
            }
            if ($article !== '') {
                $original_articles[$article] = $qty;
            }
        }
    }
    
    $products = get_products_data($input);
    $html = generate_products_table($products, $original_articles);
    
    wp_send_json_success($html);
}

add_action('wp_ajax_nopriv_product_search_by_list', 'handle_product_search_by_list');
add_action('wp_ajax_product_search_by_list', 'handle_product_search_by_list');
function handle_product_search_by_list() {
    check_ajax_referer('product_search_nonce', 'security');
    
    $articles_input = isset($_POST['articles']) ? sanitize_textarea_field($_POST['articles']) : '';
    if (empty(trim($articles_input))) {
        wp_send_json_error('Список артикулов пуст');
    }
    
    $original_articles = [];
    $input_clean = trim(str_replace(["\r\n", "\r"], "\n", $articles_input));
    if ($input_clean !== '') {
        $lines = explode("\n", $input_clean);
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '') continue;
            if (strpos($line, ':') !== false) {
                $parts = explode(':', $line, 2);
                $article = trim($parts[0]);
                $qty = max(1, (int) trim($parts[1]));
            } else {
                $article = $line;
                $qty = 1;
            }
            if ($article !== '') {
                $original_articles[$article] = $qty;
            }
        }
    }
    
    $products = get_products_data($articles_input);
    $html = generate_products_table($products, $original_articles);
    
    wp_send_json_success($html);
}

add_action('wp_ajax_nopriv_product_search_by_file', 'handle_product_search_by_file');
add_action('wp_ajax_product_search_by_file', 'handle_product_search_by_file');
function handle_product_search_by_file() {
    check_ajax_referer('product_search_nonce', 'security');
    
    if (!isset($_FILES['file']) || empty($_FILES['file']['tmp_name'])) {
        wp_send_json_error('Файл не загружен');
    }
    
    $file = $_FILES['file'];
    $file_path = $file['tmp_name'];
    $file_name = $file['name'];
    $articles = [];
    
    $ext = strtolower(pathinfo($file_name, PATHINFO_EXTENSION));
    
    try {
        if ($ext === 'csv') {
            $content = file_get_contents($file_path);
            $content = str_replace(["\r\n", "\r"], "\n", $content);
            $rows = str_getcsv($content, "\n");
            foreach ($rows as $row) {
                $row = trim($row);
                if ($row === '') continue;
                $cols = str_getcsv($row, ',');
                $article = !empty($cols[0]) ? trim($cols[0]) : null;
                $qty = !empty($cols[1]) ? (int) trim($cols[1]) : 1;
                if ($article && $qty > 0) {
                    $articles[$article] = $qty;
                }
            }
        } else {
            $reader = IOFactory::createReaderForFile($file_path);
            $spreadsheet = $reader->load($file_path);
            $worksheet = $spreadsheet->getActiveSheet();
            $rows = $worksheet->toArray(null, true, true, true);
            foreach ($rows as $row) {
                $article = !empty($row['A']) ? trim($row['A']) : null;
                $qty = !empty($row['B']) ? (int) $row['B'] : 1;
                if ($article && $qty > 0) {
                    $articles[$article] = $qty;
                }
            }
        }
    } catch (ReaderException $e) {
        wp_send_json_error('Ошибка чтения файла: некорректный формат Excel.');
    } catch (Exception $e) {
        wp_send_json_error('Ошибка обработки файла: ' . $e->getMessage());
    }
    
    if (empty($articles)) {
        wp_send_json_error('Не найдено корректных артикулов в файле. Убедитесь, что данные в 1-м и 2-м столбцах.');
    }
    
    $products = get_products_data($articles);
    $html = generate_products_table($products, $articles);
    
    wp_send_json_success($html);
}