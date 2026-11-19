<?php

namespace App\Support;

/**
 * Converts TipTap (ProseMirror) JSON documents into safe HTML.
 *
 * Only whitelisted nodes, marks and attributes are rendered and every text value is escaped,
 * so the output can be shown in the portal and fed to dompdf without further sanitising.
 */
class RichText
{
    private const MAX_DEPTH = 24;

    /** @var array<string, string> */
    private const BLOCK_TAGS = [
        'paragraph' => 'p',
        'bulletList' => 'ul',
        'orderedList' => 'ol',
        'listItem' => 'li',
        'blockquote' => 'blockquote',
        'table' => 'table',
        'tableRow' => 'tr',
        'tableHeader' => 'th',
        'tableCell' => 'td',
    ];

    /** @var array<string, string> */
    private const MARK_TAGS = [
        'bold' => 'strong',
        'italic' => 'em',
        'underline' => 'u',
        'strike' => 's',
    ];

    /**
     * @param  array<string, mixed>|null  $document
     */
    public static function toHtml(?array $document): string
    {
        if (! $document) {
            return '';
        }

        return self::renderNode($document, 0);
    }

    /**
     * Strip anything outside the whitelist so only known structure is ever stored.
     *
     * @param  array<string, mixed>|null  $document
     * @return array<string, mixed>|null
     */
    public static function sanitize(?array $document): ?array
    {
        if (! $document || ($document['type'] ?? null) !== 'doc') {
            return null;
        }

        return self::sanitizeNode($document, 0);
    }

    /**
     * @param  array<string, mixed>|null  $document
     */
    public static function isEmpty(?array $document): bool
    {
        return trim(self::toPlainText($document)) === ''
            && ! str_contains(self::toHtml($document), '<table');
    }

    /**
     * @param  array<string, mixed>|null  $document
     */
    public static function toPlainText(?array $document): string
    {
        if (! $document) {
            return '';
        }

        $text = '';
        $walk = function (array $node, int $depth) use (&$walk, &$text): void {
            if ($depth > self::MAX_DEPTH) {
                return;
            }

            if (($node['type'] ?? null) === 'text') {
                $text .= (string) ($node['text'] ?? '');
            }

            foreach (self::children($node) as $child) {
                $walk($child, $depth + 1);
            }

            if (isset(self::BLOCK_TAGS[$node['type'] ?? '']) || ($node['type'] ?? '') === 'heading') {
                $text .= "\n";
            }
        };
        $walk($document, 0);

        return trim(preg_replace("/\n{3,}/", "\n\n", $text) ?? '');
    }

    /**
     * Build a starter document made of level-3 headings each followed by an empty paragraph.
     *
     * @param  list<string>  $headings
     * @return array<string, mixed>
     */
    public static function fromHeadings(array $headings): array
    {
        $content = [];

        foreach ($headings as $heading) {
            $content[] = ['type' => 'heading', 'attrs' => ['level' => 3], 'content' => [['type' => 'text', 'text' => $heading]]];
            $content[] = ['type' => 'paragraph'];
        }

        return ['type' => 'doc', 'content' => $content];
    }

    /**
     * @return array<string, mixed>
     */
    public static function fromText(string $text): array
    {
        $paragraphs = array_filter(preg_split("/\R{2,}/", trim($text)) ?: [], fn ($p) => trim($p) !== '');

        return [
            'type' => 'doc',
            'content' => array_values(array_map(
                fn (string $p) => ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => trim($p)]]],
                $paragraphs,
            )),
        ];
    }

    /**
     * @param  array<string, mixed>  $node
     */
    private static function renderNode(array $node, int $depth): string
    {
        if ($depth > self::MAX_DEPTH) {
            return '';
        }

        $type = $node['type'] ?? null;

        if ($type === 'text') {
            return self::renderText($node);
        }

        if ($type === 'hardBreak') {
            return '<br>';
        }

        if ($type === 'horizontalRule') {
            return '<hr>';
        }

        $inner = '';
        foreach (self::children($node) as $child) {
            $inner .= self::renderNode($child, $depth + 1);
        }

        if ($type === 'doc') {
            return $inner;
        }

        if ($type === 'heading') {
            $level = self::headingLevel($node);

            return "<h{$level}>{$inner}</h{$level}>";
        }

        if ($type === 'table') {
            return '<table><tbody>'.$inner.'</tbody></table>';
        }

        if (! isset(self::BLOCK_TAGS[$type])) {
            return '';
        }

        $tag = self::BLOCK_TAGS[$type];

        return '<'.$tag.self::renderAttributes($type, $node['attrs'] ?? []).'>'.$inner.'</'.$tag.'>';
    }

    /**
     * @param  array<string, mixed>  $node
     */
    private static function renderText(array $node): string
    {
        $html = nl2br(e((string) ($node['text'] ?? '')), false);

        foreach (array_reverse(is_array($node['marks'] ?? null) ? $node['marks'] : []) as $mark) {
            $tag = self::MARK_TAGS[$mark['type'] ?? ''] ?? null;

            if ($tag) {
                $html = "<{$tag}>{$html}</{$tag}>";
            }
        }

        return $html;
    }

    /**
     * @param  array<string, mixed>  $attrs
     */
    private static function renderAttributes(string $type, mixed $attrs): string
    {
        if (! is_array($attrs)) {
            return '';
        }

        if ($type === 'orderedList' && isset($attrs['start']) && (int) $attrs['start'] > 1) {
            return ' start="'.(int) $attrs['start'].'"';
        }

        if (in_array($type, ['tableCell', 'tableHeader'], true)) {
            $out = '';

            foreach (['colspan', 'rowspan'] as $span) {
                $value = (int) ($attrs[$span] ?? 1);

                if ($value > 1 && $value <= 20) {
                    $out .= ' '.$span.'="'.$value.'"';
                }
            }

            return $out;
        }

        return '';
    }

    /**
     * @param  array<string, mixed>  $node
     * @return array<string, mixed>|null
     */
    private static function sanitizeNode(array $node, int $depth): ?array
    {
        $type = $node['type'] ?? null;

        if ($depth > self::MAX_DEPTH || ! is_string($type)) {
            return null;
        }

        if ($type === 'text') {
            $text = (string) ($node['text'] ?? '');

            if ($text === '') {
                return null;
            }

            $marks = array_values(array_filter(
                is_array($node['marks'] ?? null) ? $node['marks'] : [],
                fn ($mark) => is_array($mark) && isset(self::MARK_TAGS[$mark['type'] ?? '']),
            ));

            return array_filter([
                'type' => 'text',
                'text' => mb_substr($text, 0, 20000),
                'marks' => array_map(fn ($mark) => ['type' => $mark['type']], $marks) ?: null,
            ]);
        }

        if (in_array($type, ['hardBreak', 'horizontalRule'], true)) {
            return ['type' => $type];
        }

        if ($type !== 'doc' && $type !== 'heading' && ! isset(self::BLOCK_TAGS[$type])) {
            return null;
        }

        $clean = ['type' => $type];

        if ($type === 'heading') {
            $clean['attrs'] = ['level' => self::headingLevel($node)];
        } elseif ($type === 'orderedList' && (int) ($node['attrs']['start'] ?? 1) > 1) {
            $clean['attrs'] = ['start' => (int) $node['attrs']['start']];
        } elseif (in_array($type, ['tableCell', 'tableHeader'], true)) {
            $clean['attrs'] = [
                'colspan' => max(1, min(20, (int) ($node['attrs']['colspan'] ?? 1))),
                'rowspan' => max(1, min(20, (int) ($node['attrs']['rowspan'] ?? 1))),
            ];
        }

        $children = [];
        foreach (self::children($node) as $child) {
            $cleanChild = self::sanitizeNode($child, $depth + 1);

            if ($cleanChild !== null) {
                $children[] = $cleanChild;
            }
        }

        if ($children) {
            $clean['content'] = $children;
        }

        return $clean;
    }

    /**
     * @param  array<string, mixed>  $node
     */
    private static function headingLevel(array $node): int
    {
        return max(2, min(4, (int) ($node['attrs']['level'] ?? 2)));
    }

    /**
     * @param  array<string, mixed>  $node
     * @return list<array<string, mixed>>
     */
    private static function children(array $node): array
    {
        return array_values(array_filter(
            is_array($node['content'] ?? null) ? $node['content'] : [],
            'is_array',
        ));
    }
}
