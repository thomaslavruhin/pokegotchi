<?php
/**
 * Gera o index.html (o jogo em um único arquivo) e o sw.js (service worker do PWA) a partir de src/.
 *
 *   php tools/build.php
 *
 * - src/game.html ............ HTML/CSS/JS do jogo (o núcleo: habitat, cuidados, cenas), com os marcadores:
 *     /*SPRITES_JSON*\/{}  -> sprites em data URI (o jogo funciona offline e dentro de sandboxes que bloqueiam imagens externas)
 *     /*DATA_JS*\/         -> dados gerados (src/data/*.js: POKéDEX, paletas brilhantes)
 *     /*BIOMES_JS*\/       -> o código dos biomas (src/biomes/*.js)
 *     /*MODULES_JS*\/      -> as telas da aventura (src/modules/*.js, em ordem alfabética)
 *     /*MODULES_CSS*\/     -> o CSS delas (src/modules/*.css)
 *     /*FONTS_CSS*\/       -> @font-face em data URI (src/fonts/{press-start-2p,vt323}.woff2)
 * - src/sprites/front/1..151.png e back/1..151.png (FRLG), src/sprites/berry.png
 */
$root = dirname(__DIR__);
$game = file_get_contents("$root/src/game.html");

// chaves: f1..f151 (frente), b1..b151 (costas), berry
$sprites = [];
$files = ['berry' => 'berry.png'];
foreach (['f' => 'front', 'b' => 'back'] as $p => $dir) foreach (range(1, 151) as $id) $files["$p$id"] = "$dir/$id.png";
foreach ($files as $k => $f) {
    $png = "$root/src/sprites/$f";
    if (!is_file($png)) fail("sprite ausente: src/sprites/$f");
    $sprites[$k] = 'data:image/png;base64,' . base64_encode(file_get_contents($png));
}

// dados e módulos: todos os arquivos da pasta, em ordem alfabética (glob já ordena)
function concat(string $pattern): string {
    $out = '';
    foreach (glob($pattern) as $f) $out .= "\n/* ── " . basename($f) . " ── */\n" . trim(file_get_contents($f)) . "\n";
    return $out;
}

$biomes = '';
foreach (['floresta', 'vulcao', 'praia'] as $k) {
    $js = "$root/src/biomes/$k.js";
    if (!is_file($js)) fail("bioma ausente: src/biomes/$k.js");
    $biomes .= "\n/* ── bioma: $k ── */\n" . trim(file_get_contents($js)) . "\n";
}

$fonts = [];
foreach (['Press Start 2P' => 'press-start-2p', 'VT323' => 'vt323'] as $family => $k) {
    $woff2 = "$root/src/fonts/$k.woff2";
    if (!is_file($woff2)) fail("fonte ausente: src/fonts/$k.woff2");
    $fonts[] = "@font-face { font-family: \"$family\"; font-display: swap; src: url(data:font/woff2;base64," . base64_encode(file_get_contents($woff2)) . ") format(\"woff2\"); }";
}

$marks = [
    '/*SPRITES_JSON*/{}' => json_encode($sprites, JSON_UNESCAPED_SLASHES), '/*DATA_JS*/' => concat("$root/src/data/*.js"),
    '/*BIOMES_JS*/' => $biomes, '/*MODULES_JS*/' => concat("$root/src/modules/*.js"), '/*MODULES_CSS*/' => concat("$root/src/modules/*.css"),
    '/*FONTS_CSS*/' => implode("\n", $fonts),
];
foreach ($marks as $mark => $value) {
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
