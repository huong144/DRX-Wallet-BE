# s-wallet-sol-base
## SET LIMIT_OF_PARAMS

For the crawler to work, SolGateway will use the batch request to query the block information, LIMIT_OF_PARAMS needs to be set if the RPC server sets a request body size limit.

```
    EX: LIMIT_OF_PARAMS = 200
```
