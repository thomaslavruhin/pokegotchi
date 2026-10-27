<?php
/**
 * Gera os ícones do app (PWA) em icons/: uma Pokébola em pixel art 32×32 ampliada sem suavização.
 *
 *   php tools/make-icons.php
 *
 * PNG escrito à mão (zlib + CRC), sem depender da extensão GD.
 */
$root = dirname(__DIR__);
@mkdir("$root/icons");

const BG = [0x15, 0x17, 0x2b, 255];   // fundo da mesa (mesma cor da página)

// ── Pokébola 32×32 ──
function ball(): array {
    $K = [0x18, 0x16, 0x1f, 255]; $R = [0xe2, 0x37, 0x2c, 255]; $r = [0x9c, 0x1d, 0x1c, 255]; $h = [0xff, 0x70, 0x5c, 255];
    $W = [0xee, 0xf1, 0xf5, 255]; $w = [0xbf, 0xc7, 0xd3, 255]; $G = [0x2b, 0x29, 0x34, 255]; $C = [0xf8, 0xf8, 0xf8, 255];
    $px = [];
    for ($y = 0; $y < 32; $y++) for ($x = 0; $x < 32; $x++) {
        $dx = $x - 15.5; $dy = $y - 15.5; $d = sqrt($dx * $dx + $dy * $dy); $col = null;
        if ($d <= 14.6) {
            if ($d > 13.4) $col = $K;                                          // contorno
            elseif ($y >= 14 && $y <= 17) $col = $K;                          // faixa preta
            elseif ($y < 14) $col = ($dx + $dy > 13 || $d > 12.2 && $dx > 4) ? $r : $R;   // metade vermelha com sombra embaixo/direita
            else $col = ($dx + $dy > 14 || $d > 12.2 && $dx > 4) ? $w : $W;   // metade branca com sombra
            $cd = sqrt($dx * $dx + ($dy) * ($dy));
            if ($cd <= 5.2) $col = $K;                                         // aro do botão
            if ($cd <= 4.1) $col = $G;
            if ($cd <= 3.2) $col = $C;
            if ($cd <= 3.2 && $dx + $dy > 1.5) $col = $w;
        }
        $px[$y][$x] = $col;
    }
    // brilho no canto superior esquerdo do vermelho
    foreach ([[8, 6], [9, 6], [7, 7], [8, 7], [7, 8], [10, 5], [11, 5]] as [$x, $y]) $px[$y][$x] = $h;
    foreach ([[8, 6], [7, 7]] as [$x, $y]) $px[$y][$x] = [0xff, 0xff, 0xff, 255];
    return $px;
}

/** Pinta a bola (escala inteira) centralizada numa tela size×size, com fundo opcional. */
function render(int $size, int $scale, ?array $bg): array {
    $img = array_fill(0, $size, array_fill(0, $size, $bg ?? [0, 0, 0, 0]));
    $b = ball(); $off = intdiv($size - 32 * $scale, 2);
    for ($y = 0; $y < 32; $y++) for ($x = 0; $x < 32; $x++) {
        if (!$b[$y][$x]) continue;
        for ($j = 0; $j < $scale; $j++) for ($i = 0; $i < $scale; $i++) $img[$off + $y * $scale + $j][$off + $x * $scale + $i] = $b[$y][$x];
    }
    return $img;
}

function png(string $file, array $img): void {
    $h = count($img); $w = count($img[0]); $raw = '';
    foreach ($img as $row) { $raw .= "\0"; foreach ($row as [$r, $g, $b, $a]) $raw .= chr($r) . chr($g) . chr($b) . chr($a); }
    $chunk = fn(string $type, string $data) => pack('N', strlen($data)) . $type . $data . pack('N', crc32($type . $data));
    file_put_contents($file, "\x89PNG\r\n\x1a\n"
        . $chunk('IHDR', pack('NNCCCCC', $w, $h, 8, 6, 0, 0, 0))
        . $chunk('IDAT', gzcompress($raw, 9))
        . $chunk('IEND', ''));
}

$out = [
    'icon-192.png'          => render(192, 6, null),     // "any": bola sem fundo
    'icon-512.png'          => render(512, 16, null),
    'icon-maskable-512.png' => render(512, 10, BG),      // maskable: bola dentro da zona segura (62%), fundo cheio
    'apple-touch-icon.png'  => render(180, 4, BG),       // iOS preenche transparência de preto: fundo próprio
    'favicon-32.png'        => render(32, 1, null),
];
foreach ($out as $name => $img) { png("$root/icons/$name", $img); echo "icons/$name\n"; }
