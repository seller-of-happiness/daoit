export interface AlphabetLetter {
    letter: string
    active: boolean
}

export interface LinkItem {
    title: string
    url: string
}

export interface Group {
    letter: string
    items: LinkItem[]
}

export interface DirectoryResponse {
    alphabet: {
        ru: AlphabetLetter[]
    }
    groups: {
        ru: Group[]
        az: LinkItem[]
    }
}
