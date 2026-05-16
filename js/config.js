export const CONFIG = {
  clientName:     'Xiera',
  clientSubtitle: 'Ocotlán, Jalisco',
  appName:        'Enote',
  storagePrefix:  'enote_',

  locations: ['Sucursal 1', 'Sucursal 2', 'Sucursal 3', 'Sucursal 4', 'Sucursal 5', 'Planta de Producción'],
  defaultDestino: 'Planta de Producción',

  statuses: ['Nueva', 'En Proceso', 'Completada', 'Cancelada'],

  confirmEditStatuses: ['En Proceso', 'Completada'],

  PAGE_SIZE: 20,

  roles: {
    admin:      { canCreate: true,  canEdit: true,  canDelete: true,  canSeeAll: true  },
    planta:     { canCreate: false, canEdit: false, canDelete: false, canSeeAll: false },
    sucursal:   { canCreate: true,  canEdit: true,  canDelete: true,  canSeeAll: false },
    repartidor: { canCreate: false, canEdit: false, canDelete: false, canSeeAll: true  },
  },

  googleFontsUrl:
    'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=DM+Sans:opsz,wght@9..40,400;9..40,500&display=swap',
};
