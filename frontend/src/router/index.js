// ========================================
// AIManju 路由配置 v3.8
// App.vue是根组件，不在路由里
// 只定义内容区的路由
// ========================================
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/workspace',
    name: 'Workspace',
    component: () => import('../views/Workspace.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/projects',
    name: 'Projects',
    component: () => import('../views/Projects.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/member',
    name: 'MemberCenter',
    component: () => import('../views/MemberCenter.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/teams',
    name: 'Teams',
    component: () => import('../views/Teams.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/',
    redirect: '/workspace'
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/workspace'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  const requiresAuth = to.meta.requiresAuth !== false

  if (requiresAuth && !token) {
    next('/login')
  } else if (to.path === '/login' && token) {
    next('/workspace')
  } else {
    next()
  }
})

export default router
