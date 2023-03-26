import katex from "katex"
import hljs, { HighlightResult } from "highlight.js"

enum TT {
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

const codeDelim = "```"

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
        console.log("tokens: ", tokens)
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
        console.log(delim, math)
        const displayMode = delim === '$$' || delim === '\\['
        const html = katex.renderToString(math, { displayMode });
        this.output.push(html)
    }
    addCode(code: string, language: string) {
        let highlighted: HighlightResult
        if (language) { highlighted = hljs.highlight(code.trim(), { language }) }
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
                let text = this.advance().data
                let [language, code] = this.getCodeLanguage(text)
                while (!this.isAtEnd() && this.peek().type !== TT.CodeDelim) {
                    code += this.advance().data
                }
                this.advance()
                console.log("code:", code)
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
    const scanner = new Scanner(input)
    const tokens = scanner.scan()
    const parser = new Parser(tokens)
    return parser.parse()
}

export { parseMessage }