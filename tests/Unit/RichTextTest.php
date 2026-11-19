<?php

namespace Tests\Unit;

use App\Support\RichText;
use PHPUnit\Framework\TestCase;

class RichTextTest extends TestCase
{
    public function test_renders_whitelisted_nodes_and_marks(): void
    {
        $html = RichText::toHtml([
            'type' => 'doc',
            'content' => [
                ['type' => 'heading', 'attrs' => ['level' => 3], 'content' => [['type' => 'text', 'text' => 'Summary']]],
                ['type' => 'paragraph', 'content' => [
                    ['type' => 'text', 'text' => 'Loans grew', 'marks' => [['type' => 'bold'], ['type' => 'underline']]],
                    ['type' => 'hardBreak'],
                    ['type' => 'text', 'text' => 'by 12%'],
                ]],
                ['type' => 'bulletList', 'content' => [
                    ['type' => 'listItem', 'content' => [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'One']]]]],
                ]],
                ['type' => 'table', 'content' => [
                    ['type' => 'tableRow', 'content' => [
                        ['type' => 'tableHeader', 'attrs' => ['colspan' => 2], 'content' => [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'Head']]]]],
                    ]],
                ]],
            ],
        ]);

        $this->assertSame(
            '<h3>Summary</h3><p><strong><u>Loans grew</u></strong><br>by 12%</p>'
            .'<ul><li><p>One</p></li></ul>'
            .'<table><tbody><tr><th colspan="2"><p>Head</p></th></tr></tbody></table>',
            $html,
        );
    }

    public function test_escapes_text_and_drops_unknown_nodes_marks_and_attributes(): void
    {
        $html = RichText::toHtml([
            'type' => 'doc',
            'content' => [
                ['type' => 'paragraph', 'attrs' => ['class' => 'x', 'onclick' => 'alert(1)'], 'content' => [
                    ['type' => 'text', 'text' => '<script>alert("x")</script>', 'marks' => [['type' => 'link', 'attrs' => ['href' => 'javascript:alert(1)']]]],
                ]],
                ['type' => 'iframe', 'attrs' => ['src' => 'https://evil.test'], 'content' => [['type' => 'text', 'text' => 'hidden']]],
                ['type' => 'heading', 'attrs' => ['level' => '1 onload=alert(1)'], 'content' => [['type' => 'text', 'text' => 'T']]],
            ],
        ]);

        $this->assertSame('<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</p><h2>T</h2>', $html);
    }

    public function test_sanitize_keeps_only_known_structure(): void
    {
        $clean = RichText::sanitize([
            'type' => 'doc',
            'content' => [
                ['type' => 'paragraph', 'attrs' => ['style' => 'color:red'], 'content' => [
                    ['type' => 'text', 'text' => 'Hi', 'marks' => [['type' => 'italic', 'attrs' => ['x' => 1]], ['type' => 'link']]],
                ]],
                ['type' => 'image', 'attrs' => ['src' => 'x.png']],
            ],
        ]);

        $this->assertSame([
            'type' => 'doc',
            'content' => [
                ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'Hi', 'marks' => [['type' => 'italic']]]]],
            ],
        ], $clean);
    }

    public function test_sanitize_rejects_documents_without_a_doc_root(): void
    {
        $this->assertNull(RichText::sanitize(['type' => 'paragraph']));
    }

    public function test_empty_documents_are_detected(): void
    {
        $this->assertTrue(RichText::isEmpty(RichText::fromHeadings([])));
        $this->assertTrue(RichText::isEmpty(null));
        $this->assertFalse(RichText::isEmpty(RichText::fromText('Quarterly update')));
    }
}
