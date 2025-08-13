// Bulgaria administrative divisions data
// Source: Official Bulgarian administrative divisions

export interface Province {
  code: string;
  name: string;
  cities: City[];
}

export interface City {
  name: string;
  type: 'град' | 'село' | 'квартал';
}

export const BULGARIA_PROVINCES: Province[] = [
  {
    code: 'BGS11',
    name: 'Благоевград',
    cities: [
      { name: 'Благоевград', type: 'град' },
      { name: 'Банско', type: 'град' },
      { name: 'Гоце Делчев', type: 'град' },
      { name: 'Петрич', type: 'град' },
      { name: 'Разлог', type: 'град' },
      { name: 'Сандански', type: 'град' },
      { name: 'Симитли', type: 'град' },
      { name: 'Струмяни', type: 'град' },
      { name: 'Хаджидимово', type: 'град' },
      { name: 'Якоруда', type: 'град' }
    ]
  },
  {
    code: 'BGS12',
    name: 'Бургас',
    cities: [
      { name: 'Бургас', type: 'град' },
      { name: 'Айтос', type: 'град' },
      { name: 'Карнобат', type: 'град' },
      { name: 'Малко Търново', type: 'град' },
      { name: 'Несебър', type: 'град' },
      { name: 'Обзор', type: 'град' },
      { name: 'Поморие', type: 'град' },
      { name: 'Приморско', type: 'град' },
      { name: 'Руен', type: 'град' },
      { name: 'Созопол', type: 'град' },
      { name: 'Средец', type: 'град' },
      { name: 'Сунгурларе', type: 'град' },
      { name: 'Царево', type: 'град' }
    ]
  },
  {
    code: 'BGS13',
    name: 'Варна',
    cities: [
      { name: 'Варна', type: 'град' },
      { name: 'Аксаково', type: 'град' },
      { name: 'Белослав', type: 'град' },
      { name: 'Бяла', type: 'град' },
      { name: 'Девня', type: 'град' },
      { name: 'Долни Чифлик', type: 'град' },
      { name: 'Дългопол', type: 'град' },
      { name: 'Провадия', type: 'град' },
      { name: 'Суворово', type: 'град' },
      { name: 'Ахтопол', type: 'град' }
    ]
  },
  {
    code: 'BGS14',
    name: 'Велико Търново',
    cities: [
      { name: 'Велико Търново', type: 'град' },
      { name: 'Горна Оряховица', type: 'град' },
      { name: 'Елена', type: 'град' },
      { name: 'Златарица', type: 'град' },
      { name: 'Лясковец', type: 'град' },
      { name: 'Павликени', type: 'град' },
      { name: 'Полски Тръмбеш', type: 'град' },
      { name: 'Свищов', type: 'град' },
      { name: 'Стражица', type: 'град' },
      { name: 'Сухинддол', type: 'град' }
    ]
  },
  {
    code: 'BGS15',
    name: 'Видин',
    cities: [
      { name: 'Видин', type: 'град' },
      { name: 'Белоградчик', type: 'град' },
      { name: 'Бойница', type: 'град' },
      { name: 'Брегово', type: 'град' },
      { name: 'Грамада', type: 'град' },
      { name: 'Димово', type: 'град' },
      { name: 'Кула', type: 'град' },
      { name: 'Макреш', type: 'град' },
      { name: 'Ново село', type: 'град' },
      { name: 'Ружинци', type: 'град' }
    ]
  },
  {
    code: 'BGS16',
    name: 'Враца',
    cities: [
      { name: 'Враца', type: 'град' },
      { name: 'Борован', type: 'град' },
      { name: 'Бяла Слатина', type: 'град' },
      { name: 'Козлодуй', type: 'град' },
      { name: 'Криводол', type: 'град' },
      { name: 'Мездра', type: 'град' },
      { name: 'Мизия', type: 'град' },
      { name: 'Оряхово', type: 'град' },
      { name: 'Роман', type: 'град' },
      { name: 'Хайредин', type: 'град' }
    ]
  },
  {
    code: 'BGS17',
    name: 'Габрово',
    cities: [
      { name: 'Габрово', type: 'град' },
      { name: 'Дряново', type: 'град' },
      { name: 'Севлиево', type: 'град' },
      { name: 'Трявна', type: 'град' }
    ]
  },
  {
    code: 'BGS18',
    name: 'Добрич',
    cities: [
      { name: 'Добрич', type: 'град' },
      { name: 'Балчик', type: 'град' },
      { name: 'Генерал Тошево', type: 'град' },
      { name: 'Добричка', type: 'град' },
      { name: 'Каварна', type: 'град' },
      { name: 'Крушари', type: 'град' },
      { name: 'Тервел', type: 'град' },
      { name: 'Шабла', type: 'град' }
    ]
  },
  {
    code: 'BGS19',
    name: 'Кърджали',
    cities: [
      { name: 'Кърджали', type: 'град' },
      { name: 'Ардино', type: 'град' },
      { name: 'Джебел', type: 'град' },
      { name: 'Кирково', type: 'град' },
      { name: 'Крумовград', type: 'град' },
      { name: 'Момчилград', type: 'град' },
      { name: 'Черноочене', type: 'град' }
    ]
  },
  {
    code: 'BGS1A',
    name: 'Кюстендил',
    cities: [
      { name: 'Кюстендил', type: 'град' },
      { name: 'Бобов дол', type: 'град' },
      { name: 'Бобошево', type: 'град' },
      { name: 'Дупница', type: 'град' },
      { name: 'Невестино', type: 'град' },
      { name: 'Рила', type: 'град' },
      { name: 'Сапарева баня', type: 'град' },
      { name: 'Трекляно', type: 'град' }
    ]
  },
  {
    code: 'BGS1B',
    name: 'Ловеч',
    cities: [
      { name: 'Ловеч', type: 'град' },
      { name: 'Априлци', type: 'град' },
      { name: 'Летница', type: 'град' },
      { name: 'Луковит', type: 'град' },
      { name: 'Тетевен', type: 'град' },
      { name: 'Троян', type: 'град' },
      { name: 'Угърчин', type: 'град' },
      { name: 'Ябланица', type: 'град' }
    ]
  },
  {
    code: 'BGS1C',
    name: 'Монтана',
    cities: [
      { name: 'Монтана', type: 'град' },
      { name: 'Берковица', type: 'град' },
      { name: 'Бойчиновци', type: 'град' },
      { name: 'Брусарци', type: 'град' },
      { name: 'Вълчедръм', type: 'град' },
      { name: 'Георги Дамяново', type: 'град' },
      { name: 'Лом', type: 'град' },
      { name: 'Медковец', type: 'град' },
      { name: 'Чипровци', type: 'град' },
      { name: 'Якимово', type: 'град' }
    ]
  },
  {
    code: 'BGS1D',
    name: 'Пазарджик',
    cities: [
      { name: 'Пазарджик', type: 'град' },
      { name: 'Батак', type: 'град' },
      { name: 'Белово', type: 'град' },
      { name: 'Брацигово', type: 'град' },
      { name: 'Велинград', type: 'град' },
      { name: 'Лесичово', type: 'град' },
      { name: 'Панагюрище', type: 'град' },
      { name: 'Пещера', type: 'град' },
      { name: 'Ракитово', type: 'град' },
      { name: 'Септември', type: 'град' },
      { name: 'Стрелча', type: 'град' }
    ]
  },
  {
    code: 'BGS1E',
    name: 'Перник',
    cities: [
      { name: 'Перник', type: 'град' },
      { name: 'Брезник', type: 'град' },
      { name: 'Земен', type: 'град' },
      { name: 'Ковачевци', type: 'град' },
      { name: 'Радомир', type: 'град' },
      { name: 'Трън', type: 'град' }
    ]
  },
  {
    code: 'BGS1F',
    name: 'Плевен',
    cities: [
      { name: 'Плевен', type: 'град' },
      { name: 'Белене', type: 'град' },
      { name: 'Гулянци', type: 'град' },
      { name: 'Долна Митрополия', type: 'град' },
      { name: 'Долни Дъбник', type: 'град' },
      { name: 'Искър', type: 'град' },
      { name: 'Кнежа', type: 'град' },
      { name: 'Левски', type: 'град' },
      { name: 'Никопол', type: 'град' },
      { name: 'Пордим', type: 'град' }
    ]
  },
  {
    code: 'BGS1G',
    name: 'Пловдив',
    cities: [
      { name: 'Пловдив', type: 'град' },
      { name: 'Асеновград', type: 'град' },
      { name: 'Брезово', type: 'град' },
      { name: 'Калояново', type: 'град' },
      { name: 'Карлово', type: 'град' },
      { name: 'Кричим', type: 'град' },
      { name: 'Куклен', type: 'град' },
      { name: 'Лъки', type: 'град' },
      { name: 'Марица', type: 'град' },
      { name: 'Перущица', type: 'град' },
      { name: 'Първомай', type: 'град' },
      { name: 'Раковски', type: 'град' },
      { name: 'Родопи', type: 'град' },
      { name: 'Садово', type: 'град' },
      { name: 'Сопот', type: 'град' },
      { name: 'Стамболийски', type: 'град' },
      { name: 'Съединение', type: 'град' },
      { name: 'Хисаря', type: 'град' }
    ]
  },
  {
    code: 'BGS1H',
    name: 'Разград',
    cities: [
      { name: 'Разград', type: 'град' },
      { name: 'Исперих', type: 'град' },
      { name: 'Кубрат', type: 'град' },
      { name: 'Лозница', type: 'град' },
      { name: 'Самуил', type: 'град' },
      { name: 'Цар Калоян', type: 'град' },
      { name: 'Завет', type: 'град' }
    ]
  },
  {
    code: 'BGS1I',
    name: 'Русе',
    cities: [
      { name: 'Русе', type: 'град' },
      { name: 'Бяла', type: 'град' },
      { name: 'Ветово', type: 'град' },
      { name: 'Две могили', type: 'град' },
      { name: 'Иваново', type: 'град' },
      { name: 'Сливо поле', type: 'град' },
      { name: 'Ценово', type: 'град' }
    ]
  },
  {
    code: 'BGS1J',
    name: 'Силистра',
    cities: [
      { name: 'Силистра', type: 'град' },
      { name: 'Алфатар', type: 'град' },
      { name: 'Дулово', type: 'град' },
      { name: 'Кайнарджа', type: 'град' },
      { name: 'Главиница', type: 'град' },
      { name: 'Ситово', type: 'град' },
      { name: 'Тутракан', type: 'град' }
    ]
  },
  {
    code: 'BGS1K',
    name: 'Сливен',
    cities: [
      { name: 'Сливен', type: 'град' },
      { name: 'Котел', type: 'град' },
      { name: 'Нова Загора', type: 'град' },
      { name: 'Твърдица', type: 'град' }
    ]
  },
  {
    code: 'BGS1L',
    name: 'Смолян',
    cities: [
      { name: 'Смолян', type: 'град' },
      { name: 'Банките', type: 'град' },
      { name: 'Борино', type: 'град' },
      { name: 'Девин', type: 'град' },
      { name: 'Доспат', type: 'град' },
      { name: 'Златоград', type: 'град' },
      { name: 'Мадан', type: 'град' },
      { name: 'Неделино', type: 'град' },
      { name: 'Рудозем', type: 'град' },
      { name: 'Чепеларе', type: 'град' }
    ]
  },
  {
    code: 'BGS21',
    name: 'София-град',
    cities: [
      { name: 'София', type: 'град' }
    ]
  },
  {
    code: 'BGS22',
    name: 'София-област',
    cities: [
      { name: 'Банкя', type: 'град' },
      { name: 'Божурище', type: 'град' },
      { name: 'Ботевград', type: 'град' },
      { name: 'Годеч', type: 'град' },
      { name: 'Горна Малина', type: 'град' },
      { name: 'Долна баня', type: 'град' },
      { name: 'Драгоман', type: 'град' },
      { name: 'Елин Пелин', type: 'град' },
      { name: 'Етрополе', type: 'град' },
      { name: 'Златица', type: 'град' },
      { name: 'Ихтиман', type: 'град' },
      { name: 'Копривщица', type: 'град' },
      { name: 'Костенец', type: 'град' },
      { name: 'Костинброд', type: 'град' },
      { name: 'Мирково', type: 'град' },
      { name: 'Пирдоп', type: 'град' },
      { name: 'Правец', type: 'град' },
      { name: 'Самоков', type: 'град' },
      { name: 'Своге', type: 'град' },
      { name: 'Сливница', type: 'град' },
      { name: 'Чавдар', type: 'град' }
    ]
  },
  {
    code: 'BGS23',
    name: 'Стара Загора',
    cities: [
      { name: 'Стара Загора', type: 'град' },
      { name: 'Братя Даскалови', type: 'град' },
      { name: 'Гурково', type: 'град' },
      { name: 'Гълъбово', type: 'град' },
      { name: 'Казанлък', type: 'град' },
      { name: 'Мъглиж', type: 'град' },
      { name: 'Николаево', type: 'град' },
      { name: 'Опан', type: 'град' },
      { name: 'Павел баня', type: 'град' },
      { name: 'Раднево', type: 'град' },
      { name: 'Чирпан', type: 'град' }
    ]
  },
  {
    code: 'BGS24',
    name: 'Търговище',
    cities: [
      { name: 'Търговище', type: 'град' },
      { name: 'Антоново', type: 'град' },
      { name: 'Омуртаг', type: 'град' },
      { name: 'Опака', type: 'град' },
      { name: 'Попово', type: 'град' }
    ]
  },
  {
    code: 'BGS25',
    name: 'Хасково',
    cities: [
      { name: 'Хасково', type: 'град' },
      { name: 'Димитровград', type: 'град' },
      { name: 'Ивайловград', type: 'град' },
      { name: 'Любимец', type: 'град' },
      { name: 'Маджарово', type: 'град' },
      { name: 'Минерални бани', type: 'град' },
      { name: 'Свиленград', type: 'град' },
      { name: 'Симеоновград', type: 'град' },
      { name: 'Стамболово', type: 'град' },
      { name: 'Тополовград', type: 'град' },
      { name: 'Харманли', type: 'град' }
    ]
  },
  {
    code: 'BGS26',
    name: 'Шумен',
    cities: [
      { name: 'Шумен', type: 'град' },
      { name: 'Венец', type: 'град' },
      { name: 'Върбица', type: 'град' },
      { name: 'Каспичан', type: 'град' },
      { name: 'Китен', type: 'град' },
      { name: 'Нови пазар', type: 'град' },
      { name: 'Хитрино', type: 'град' }
    ]
  },
  {
    code: 'BGS27',
    name: 'Ямбол',
    cities: [
      { name: 'Ямбол', type: 'град' },
      { name: 'Болярово', type: 'град' },
      { name: 'Елхово', type: 'град' },
      { name: 'Стралджа', type: 'град' },
      { name: 'Тунджа', type: 'град' }
    ]
  }
];

export const findProvinceByName = (name: string): Province | undefined => {
  return BULGARIA_PROVINCES.find(province => 
    province.name.toLowerCase() === name.toLowerCase()
  );
};

export const findCitiesByProvince = (provinceName: string): City[] => {
  const province = findProvinceByName(provinceName);
  return province ? province.cities : [];
};