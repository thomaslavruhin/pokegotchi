<?php
/**
 * Gera o index.html (o jogo em um único arquivo) e o sw.js (service worker do PWA) a partir de src/.
 *
 *   php tools/build.php
 *
 * - src/game.html ............ HTML/CSS/JS do jogo, com dois marcadores:
 *     /*SPRITES_JSON*\/{}  -> sprites em data URI (o jogo funciona offline e dentro de sandboxes que bloqueiam imagens externas)
 *     /*BIOMES_JS*\/       -> o código dos biomas (src/biomes/*.js)
 * - src/sprites/{1..9,berry}.png
 * - src/biomes/{floresta,vulcao,praia}.js
 */
$root = dirname(__DIR__);
$game = file_get_contents("$root/src/game.html");

$sprites = [];
foreach (array_merge(range(1, 9), ['berry']) as $k) {
    $png = "$root/src/sprites/$k.png";
    if (!is_file($png)) fail("sprite ausente: src/sprites/$k.png");
    $sprites[(string) $k] = 'data:image/png;base64,' . base64_encode(file_get_contents($png));
}

$biomes = '';
foreach (['floresta', 'vulcao', 'praia'] as $k) {
    $js = "$root/src/biomes/$k.js";
    if (!is_file($js)) fail("bioma ausente: src/biomes/$k.js");
    $biomes .= "\n/* ── bioma: $k ── */\n" . trim(file_get_contents($js)) . "\n";
}

foreach (['/*SPRITES_JSON*/{}' => json_encode($sprites, JSON_UNESCAPED_SLASHES), '/*BIOMES_JS*/' => $biomes] as $mark => $value) {
    if (substr_count($game, $mark) !== 1) fail("marcador $mark precisa aparecer exatamente 1 vez em src/game.html");
    $game = str_replace($mark, $value, $game);
}

// Na versão web o nome é Pokégotchi (o aparelho dentro do jogo continua sendo o POKé HABITAT)
$game = str_replace('<title>PokéHabitat</title>', '<title>Pokégotchi</title>', $game);

// Cabeçalho da versão web: PWA (manifest, ícones, service worker) e prévia de link
$desc = 'Tamagotchi retrô no estilo Pokémon FireRed/LeafGreen: cuide do seu Pokémon dentro da Pokébola.';
$head = <<<HTML
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="$desc">
<meta name="theme-color" content="#15172b">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Pokégotchi">
<meta property="og:type" content="website">
<meta property="og:title" content="Pokégotchi">
<meta property="og:description" content="$desc">
<meta property="og:image" content="https://thomaslavruhin.github.io/pokegotchi/docs/img/banner.png">
<style>body{margin:0}</style>
<script>if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));</script>
HTML;

$html = "<!doctype html>\n<html lang=\"pt-BR\">\n<head>\n$head\n</head>\n<body>\n" . $game . "\n</body>\n</html>\n";
file_put_contents("$root/index.html", $html);
printf("index.html gerado (%s KB)\n", number_format(strlen($html) / 1024, 1));

// Service worker com a versão = hash de tudo que ele guarda (página, manifest, ícones, o próprio SW):
// qualquer mudança => cache novo
$sw = file_get_contents("$root/src/sw.js");
if (substr_count($sw, '/*VERSION*/') !== 1) fail('marcador /*VERSION*/ precisa aparecer exatamente 1 vez em src/sw.js');
$stamp = $html . $sw . file_get_contents("$root/manifest.webmanifest");
foreach (glob("$root/icons/*.png") as $icon) $stamp .= file_get_contents($icon);
file_put_contents("$root/sw.js", str_replace('/*VERSION*/', substr(sha1($stamp), 0, 10), $sw));
echo "sw.js gerado\n";

function fail(string $msg): void { fwrite(STDERR, "erro: $msg\n"); exit(1); }
