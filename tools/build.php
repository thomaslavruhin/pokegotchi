<?php
/**
 * Gera o index.html (o jogo em um único arquivo) a partir de src/.
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

$html = "<!doctype html>\n<html lang=\"pt-BR\">\n<head>\n<meta charset=\"utf-8\">\n"
      . "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n"
      . "<style>body{margin:0}</style>\n</head>\n<body>\n" . $game . "\n</body>\n</html>\n";
file_put_contents("$root/index.html", $html);
printf("index.html gerado (%s KB)\n", number_format(strlen($html) / 1024, 1));

function fail(string $msg): void { fwrite(STDERR, "erro: $msg\n"); exit(1); }
