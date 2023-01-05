export function getTableName(table: string) {
  return `${process.env.TYPEORM_PREFIX ? process.env.TYPEORM_PREFIX : ''}${table}`;
}
