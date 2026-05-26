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
};

export const BUSINESS_INFO = {
  instagram: 'xiera.xiera',
  phone:     '392 92 2 42 29',
  address:   'Ramón Corona 423, Centro, Ocotlán, Jalisco',
  facebook:  'Xiera',
};
