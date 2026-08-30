<script>
import { checkApiOnline } from './utils/userService.js'
import { hasPrivacyAgreed } from './utils/privacy.js'
import { safeReLaunch } from './utils/nav.js'

export default {
  onLaunch() {
    this.routeByPrivacy()
  },
  onShow() {
    this.routeByPrivacy()
  },
  methods: {
    routeByPrivacy() {
      const pages = getCurrentPages()
      const current = pages[pages.length - 1]
      const route = current?.route || ''
      const onLegal = route.includes('legal/')

      // 仅首次未同意协议时进入提示页；不拦截登录/首页，方便先浏览再自愿登录
      if (!hasPrivacyAgreed() && !onLegal) {
        safeReLaunch('/pages/legal/consent')
        return
      }

      this.initApp()
    },
    async initApp() {
      try {
        await checkApiOnline()
      } catch {
        // offline ok
      }
    },
  },
}
</script>

<style lang="scss">
@import './styles/global.scss';
</style>
