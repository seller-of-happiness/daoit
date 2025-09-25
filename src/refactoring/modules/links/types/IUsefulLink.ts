export interface IUsefulLink {
  id: number
  name: string
  logo: string | null
  description: string
  url: string
  created_at?: string
  updated_at?: string
}

export interface IUsefulLinksStoreState {
  nextUsefulLinksCursor: string | null
  links: IUsefulLink[]
  filters: {
    search: string
  }
}


