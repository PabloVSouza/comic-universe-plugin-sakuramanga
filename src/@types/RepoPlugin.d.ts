interface IRepoPluginMethods {
  getList(): Promise<IComic[]>
  search(input: { search: string }): Promise<IComic[]>
  getDetails(search: { [key: string]: string }): Promise<Partial<IComic>>
  getChapters(input: { siteId: string }): Promise<IChapter[]>
  getPages?(input: { siteLink: string }): Promise<IPage[]>
  downloadChapter?(input: {
    comic: IComic
    chapter: IChapter
  }): Promise<{ cover: string; pageFiles: IPage[] }>
}

interface ICloudflareChallenge {
  type: 'captcha' | 'challenge' | 'verification'
  url: string
  title: string
  message: string
  requiresUserInteraction: boolean
}

interface IUserInteractionCallback {
  showCloudflareChallenge(challenge: ICloudflareChallenge): Promise<boolean>
  showError(message: string, details?: string): Promise<void>
  showProgress(message: string): Promise<void>
}

interface IRepoPluginRepository {
  RepoName: string
  RepoUrl: string
  RepoTag: string
  methods: IRepoPluginMethods
}

interface IRepoPluginRepositoryConstruct {
  new (): IRepoPluginRepository
}

interface IRepoPluginRepositoryInit {
  path: string
  url: string
  userInteraction?: IUserInteractionCallback
}

interface IRepoPluginInfo {
  name: string
  author: string
  repository: string
  path: string
  iconPath: string
  version: string
}

interface IRepoApiPluginList {
  name: string
  repo: string
  tag: string
}
