import { getConnection } from 'typeorm';
import { hd } from '../..';

export async function getEnvConfig(req: any, res: any) {
  // tslint:disable-next-line:no-shadowed-variable
  let envConfig;
  const search = req.query.search ? req.query.search : undefined;
  envConfig = await hd.getEnvConfig(search);
  if (!envConfig) {
    return res.status(400).json({ error: 'Cold wallet not found' });
  }
  return res.json(envConfig);
}

export async function updateEnvConfig(req: any, res: any) {
  try {
    await getConnection().transaction(async manager => {
      const key = req.body.key;
      const value = req.body.value;
      const coldWallet = await hd.updateEnvConfig(key, value, manager);
      if (coldWallet.raw.affectedRows === 1) {
        return res.status(200).json({ message: 'Update env config cold wallet success' });
      } else {
        return res.status(400).json({ error: 'Do not update env config cold wallet for this currency' });
      }
    });
  } catch (error) {
    return res.status(500).json({ error: error.toString() });
  }
}
