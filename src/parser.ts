import katex from "katex"
import hljs, { HighlightResult } from "highlight.js"
import sanitizeHtml from 'sanitize-html';

enum TT { // Tokentype
    Text = "Text",
    LatexDelim = "LatexDelim",
    CodeDelim = "CodeDelim",
}
class Token {
    type: TT 
    data: any 
    constructor(type: TT, data: any) {
        this.type = type 
        this.data = data
    }
}

function isLatexDelimiter(s: string) {
    return ['\\(', '\\[', '\\)', '\\]', '$', '$$'].includes(s)
}
function isStartOfLatexDelimiter(s: string) {
    return ['\\', '$'].includes(s)
}
function getClosingDelimiter(delim: string) {
    return  {
        '\\(': '\\)',
        '\\[': '\\]',
        '$': '$',
        '$$': '$$',
    }[delim]
}

function escapeHtml(html) {
    return html.replace(/&/g, "&amp;")
               .replace(/</g, "&lt;")
               .replace(/>/g, "&gt;")
               .replace(/"/g, "&quot;")
               .replace(/'/g, "&#039;");
}
function unescapeHtml(html) {
    return html.replace(/&amp;/g, "&")
               .replace(/&lt;/g, "<")
               .replace(/&gt;/g, ">")
               .replace(/&quot;/g, '"')
               .replace(/&#039;/g, "'");
}

class Scanner {
    input: string 
    start: number
    current: number 
    tokens: Token[]

    constructor(input) {
        this.input = input
        this.start = 0
        this.current = 0
        this.tokens = []
    }

    isAtEnd() {
        return this.current >= this.input.length
    }
    advance() {
        this.current++
        return this.input[this.current-1]
    }
    peek(offset: number = 0) {
        return this.input[this.current+offset]
    }
    addToken(type: TT, data: any) {
        const token = new Token(type, data)
        this.tokens.push(token)
    }

    scan() {
        while (!this.isAtEnd()) {
            this.start = this.current
            this.nextToken()
        }
        return this.tokens
    }

    scanText() {
        while (!this.isAtEnd()) {
            let next = this.peek()
            if (isStartOfLatexDelimiter(this.peek())) {
                if (next !== '\\') { break }
                if (isLatexDelimiter(next + this.peek(1))) { break }
            }
            if (next === "`") {
                if (this.peek(1) === "`" && this.peek(2) === "`") { break }
            }
            this.advance()
        }
        this.addToken(TT.Text, this.input.substring(this.start, this.current))
    }

    nextToken() {
        const c = this.advance()
        if (!isStartOfLatexDelimiter(c) && c !== "`") {
            this.scanText()
            return
        }
        if (isLatexDelimiter(c + this.peek())) {
            const delim = c + this.advance()
            this.addToken(TT.LatexDelim, delim)
        }
        else if (c === '$') {
            this.addToken(TT.LatexDelim, c)
        }
        else if (c === '\\') {
            this.advance()
            this.scanText()
        }
        else if (c === '`') {
            if (this.peek() === "`" && this.peek(1) === "`") {
                this.advance(); this.advance()
                this.addToken(TT.CodeDelim, "```")
            }
        }
    }
}

class Parser {
    tokens: Token[]
    current: number
    output: string[]

    constructor(tokens: Token[]) {
        this.tokens = tokens
        this.output = []
        this.current = 0
    }

    isAtEnd() {
        return this.current >= this.tokens.length
    }
    advance() {
        this.current++
        return this.tokens[this.current-1]
    }
    peek(offset: number = 0) {
        return this.tokens[this.current + offset]
    }

    addText(text: string) {
        this.output.push(text)
    }
    addKatex(delim: string, math: string) {
        math = unescapeHtml(math);
        const displayMode = delim === '$$' || delim === '\\[';
        const html = katex.renderToString(math, { displayMode, throwOnError: false });
        this.output.push(html)
    }
    addCode(code: string, language: string) {
        let highlighted: HighlightResult
        code = unescapeHtml(code.trim())
        if (language) { 
            try {
                highlighted = hljs.highlight(code, { language }) 
            } catch {
                highlighted = hljs.highlightAuto(code)
            }
        }
        else { highlighted = hljs.highlightAuto(code) }
        const html = '<pre><code">' + highlighted.value + '</code></pre>'
        this.output.push(html)
    }
    getCodeLanguage(text: string) {
        if (!text) { return null }
        for (let i = 0; i < text.length; i++) {
            if (!text[i].trim()) { 
                return [text.substring(0, i), text.substring(i)]
            }
        }
        return [text, ""]
    }
    parse() {
        while (!this.isAtEnd()) {
            const token = this.advance()
            // should only be a single token between open and closing delimiters
            if (token.type == TT.LatexDelim && this.peek(1) && getClosingDelimiter(token.data) === this.peek(1).data) {
                this.addKatex(token.data, this.advance().data)
                this.advance() // consume closing delimiter
            }
            else if (token.type === TT.CodeDelim) {
                if (this.isAtEnd()) { break }
                let text = this.advance().data
                let [language, code] = this.getCodeLanguage(text)
                while (!this.isAtEnd() && this.peek().type !== TT.CodeDelim) {
                    code += this.advance().data
                }
                if (!this.isAtEnd()) {
                    this.advance() // consume closing delimiter
                    if (this.peek() && this.peek().type === TT.Text) { // remove newline after end of code block
                        this.peek().data = this.peek().data.trimStart()
                    }
                }
                this.addCode(code, language)
            }
            else {
                this.addText(token.data)
            }
        }
        return this.output.join("")
    }
}

function parseMessage(input: string) {
    const start = performance.now()

    input = input.trim()		
    input = escapeHtml(input)
    input = sanitizeHtml(input, { allowedTags: [] })
    input = input.replace(/\n```/g, "```")
    const scanner = new Scanner(input)
    const tokens = scanner.scan()
    const parser = new Parser(tokens)
    const output = parser.parse()

    const end = performance.now()
    // console.log(`parsed ${tokens.length} tokens in ${(end - start).toFixed(2) + "ms"}`, tokens)
    return output
}

export { parseMessage }