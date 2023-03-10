import { toRaw, unref } from 'vue'
import { defineStore } from 'pinia'
import { RouteRecordRaw } from 'vue-router'
import { store } from '@/store'
import { asyncRoutes, constantRouter } from '@/router'
import { generatorDynamicRouter } from '@/router/routerUtils.js'
import { useProjectSetting } from '@/hooks/use-setting/useProjectSetting'

interface TreeHelperConfig {
  id: string
  children: string
  pid: string
}

const DEFAULT_CONFIG: TreeHelperConfig = {
  id: 'id',
  children: 'children',
  pid: 'pid'
}

const getConfig = (config: Partial<TreeHelperConfig>) => Object.assign({}, DEFAULT_CONFIG, config)

export interface IAsyncRouteState {
  menus: RouteRecordRaw[]
  routers: any[]
  addRouters: any[]
  keepAliveComponents: string[]
  isDynamicAddedRoute: boolean
}

function filter<T = any>(
  tree: T[],
  func: (n: T) => boolean,
  config: Partial<TreeHelperConfig> = {}
): T[] {
  config = getConfig(config)
  const children = config.children as string

  function listFilter(list: T[]) {
    return list
      .map((node: any) => ({ ...node }))
      .filter((node) => {
        node[children] = node[children] && listFilter(node[children])
        return func(node) || (node[children] && node[children].length)
      })
  }

  return listFilter(tree)
}

export const useAsyncRouteStore = defineStore({
  id: 'app-async-route',
  state: (): IAsyncRouteState => ({
    menus: [],
    routers: constantRouter,
    addRouters: [],
    keepAliveComponents: [],
    isDynamicAddedRoute: false
  }),
  getters: {
    getMenus(): RouteRecordRaw[] {
      return this.menus
    },
    getIsDynamicAddedRoute(): boolean {
      return this.isDynamicAddedRoute
    }
  },
  actions: {
    getRouters() {
      return toRaw(this.addRouters)
    },
    setDynamicAddedRoute(added: boolean) {
      this.isDynamicAddedRoute = added
    },
    // 设置动态路由
    setRouters(routers) {
      this.addRouters = routers
      this.routers = constantRouter.concat(routers)
    },
    setMenus(menus) {
      // 设置动态路由
      this.menus = menus
    },

    setKeepAliveComponents(compNames) {
      // 设置需要缓存的组件
      this.keepAliveComponents = compNames
    },

    async generateRoutes(data) {
      let accessedRouters
      const permissionsList = data.permissions || []

      // 筛选 permissions 有的路由
      const routeFilter = (route) => {
        const { meta } = route
        const { permissions } = meta || {}
        if (!permissions) return true
        return permissionsList.some((item: any) => permissions.includes(item.value))
      }
      // 获取 路由模式
      const { getPermissionMode } = useProjectSetting()
      const permissionMode = unref(getPermissionMode)
      // 后台路由模式 （菜单树）
      if (permissionMode === 'BACK') {
        // 动态获取菜单
        try {
          accessedRouters = await generatorDynamicRouter()
        } catch (error) {
          console.log(error)
        }
      } else {
        // 前端路由模式 （根据角色来筛选）
        try {
          // 过滤账户是否拥有某一个权限，并将菜单从加载列表移除 （递归筛选树）
          accessedRouters = filter(asyncRoutes, routeFilter)
        } catch (error) {
          console.log(error)
        }
      }
      accessedRouters = accessedRouters.filter(routeFilter)
      this.setRouters(accessedRouters)
      this.setMenus(accessedRouters)
      return toRaw(accessedRouters)
    }
  }
})

// Need to be used outside the setup
export function useAsyncRouteStoreWidthOut() {
  return useAsyncRouteStore(store)
}
