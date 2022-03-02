import {
  Fee,
  MsgExecuteContract,
  Coins,
} from '@terra-money/terra.js';

import {
  CreateTxFailed,
  Timeout,
  TxFailed,
  TxResult,
  TxUnspecifiedError,
  useConnectedWallet,
  useLCDClient,
  UserDenied,
  useWallet,
} from '@terra-money/wallet-provider';
import {
  Button,
  CssBaseline,
  Grid,
  Box,
  Container,
  Typography,
  CircularProgress,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import ErrorIcon from '@mui/icons-material/Error';

import { createTheme, ThemeProvider } from '@mui/material/styles';
import React, { useCallback, useState, useEffect } from 'react';
import NumberFormat from 'react-number-format';
import styled from 'styled-components';

const StyledNumberFormat = styled(NumberFormat)`
  width: 100%;
  height: 100%;
  font-size: 1.5em;
  border: none;
`;

const BorderedGrid = styled(Grid)`
  border: 1px solid gray;
  border-radius: 5px;
  padding: 10px;
`;
const StyledHr = styled.hr`
  width: 100%;
  color: gray;
`;

const StyledButton = styled(Button)`
  text-transform: capitalize;
  color: white;
  background: linear-gradient(
    270deg,
    rgb(120, 204, 255) 0%,
    rgb(103, 44, 255) 100%
  );
  padding: 0.5rem 0px;
  box-shadow: none;
  border: none;
  min-width: 62px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 24px;
  font-weight: 500;
  height: 72px;
  width: 100%; ;
`;

const theme = createTheme();

export function Anchor() {
  const [txResult, setTxResult] = useState<TxResult | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<boolean>(false);
  const [fee, setFee] = useState<Fee | null>(null);
  const [gasPrices, setGasPrices] = useState<Coins.Input | null>(null);
  const [value, setValue] = React.useState<string>('');
  const [rawValue, setRawValue] = React.useState<number>(0);
  const [bank, setBank] = useState<null | Coins>();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const connectedWallet = useConnectedWallet();
  const wallet = useWallet();

  const terra = useLCDClient();
  const handleNumber = (val: string) => {
    setValue(val);
  };

  const handleSetMax = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!!bank && !!fee) {
      const uusdVal = bank.get('uusd')?.amount.toString();
      setValue(
        !!uusdVal
          ? (
              (parseFloat(uusdVal) - parseFloat(fee.amount.toString())) /
              10 ** 6
            ).toString()
          : value,
      );
    }
  };
  useEffect(() => {
    if (!!bank && !!fee) {
      let parsed = value === '' ? 0 : parseFloat(value.replace(/,/g, ''));
      const rawVal = Math.floor(parsed * 10 ** 6);
      const bankUusdVal = bank.get('uusd')?.amount.toString();
      const gasFee = fee.amount.toString();
      if (
        rawVal > parseFloat(bankUusdVal || '') + parseFloat(gasFee) ||
        rawVal < 0
      )
        setAmountError(true);
      else setAmountError(false);

      setRawValue(Math.floor(parsed * 10 ** 6));
    }
  }, [value, bank, fee]);
  useEffect(() => {
    if (connectedWallet) {
      terra.bank.balance(connectedWallet.walletAddress).then(([coins]) => {
        setBank(coins);
      });
    } else {
      setBank(null);
    }
  }, [connectedWallet, terra]);
  useEffect(() => {
    (async () => {
      if (!connectedWallet) {
        return;
      }
      if (connectedWallet.network.chainID.startsWith('columbus')) {
        alert(`Please only execute this example on Testnet`);
        return;
      }

      const gasPrices = await (
        await fetch('https://fcd.terra.dev/v1/txs/gas_prices')
      ).json();
      setGasPrices(gasPrices);
      const accountInfo = await terra.auth.accountInfo(
        connectedWallet.walletAddress,
      );
      terra.tx
        .estimateFee(
          [
            {
              sequenceNumber: accountInfo.getSequenceNumber(),
              publicKey: accountInfo.getPublicKey(),
            },
          ],
          {
            msgs: [
              new MsgExecuteContract(
                connectedWallet.walletAddress, // sender
                'terra15dwd5mj8v59wpj0wvt233mf5efdff808c5tkal', // contract account address
                {
                  deposit_stable: {},
                }, // handle msg
                { uusd: 100000 }, // coins
              ),
            ],
            feeDenoms: ['uusd'],
            gasPrices,
          },
        )
        .then((fee: Fee) => {
          setFee(fee);
        })
        .catch((error: unknown) => {
          console.log(error);
        });
    })();
  }, [connectedWallet]);
  const proceed = useCallback(() => {
    if (!connectedWallet) {
      return;
    }

    if (connectedWallet.network.chainID.startsWith('columbus')) {
      alert(`Please only execute this example on Testnet`);
      return;
    }

    setTxResult(null);
    setTxError(null);
    setIsLoading(true);

    connectedWallet
      .post({
        msgs: [
          new MsgExecuteContract(
            connectedWallet.walletAddress, // sender
            'terra15dwd5mj8v59wpj0wvt233mf5efdff808c5tkal', // contract account address
            {
              deposit_stable: {},
            }, // handle msg
            { uusd: rawValue }, // coins
          ),
        ],
        feeDenoms: ['uusd'],
        gasPrices: gasPrices ? gasPrices : {},
      })
      .then((nextTxResult: TxResult) => {
        console.log(nextTxResult);
        setTxResult(nextTxResult);
      })
      .catch((error: unknown) => {
        if (error instanceof UserDenied) {
          setTxError('User Denied');
        } else if (error instanceof CreateTxFailed) {
          setTxError('Create Tx Failed: ' + error.message);
        } else if (error instanceof TxFailed) {
          setTxError('Tx Failed: ' + error.message);
        } else if (error instanceof Timeout) {
          setTxError('Timeout');
        } else if (error instanceof TxUnspecifiedError) {
          setTxError('Unspecified Error: ' + error.message);
        } else {
          setTxError(
            'Unknown Error: ' +
              (error instanceof Error ? error.message : String(error)),
          );
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [connectedWallet, rawValue]);

  return (
    <div>
      <ThemeProvider theme={theme}>
        <Container component="main" maxWidth="sm">
          <CssBaseline />
          <Box
            sx={{
              marginTop: 8,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <Box sx={{ my: 2 }}>
              <Typography component="h1" variant="h4">
                Invest
              </Typography>
            </Box>
            <Box component="form" noValidate sx={{ mt: 3 }}>
              <Grid container spacing={2}>
                <BorderedGrid container xs={12}>
                  <Grid item xs={12}>
                    <Typography component="h2" variant="h5">
                      Strategy
                    </Typography>
                  </Grid>

                  <Grid
                    container
                    direction="row"
                    justifyContent="flex-start"
                    xs={12}
                    sx={{ my: 2 }}
                  >
                    <Grid item>
                      <img
                        src="https://app.aperture.finance/static/media/terra.148067b9.png"
                        height="30"
                        alt="Anchor Protocol"
                      ></img>
                      <img
                        src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAD4AAAA+CAYAAABzwahEAAAACXBIWXMAAAsTAAALEwEAmpwYAAAFG2lUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNy4xLWMwMDAgNzkuZGFiYWNiYiwgMjAyMS8wNC8xNC0wMDozOTo0NCAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iIHhtbG5zOnBob3Rvc2hvcD0iaHR0cDovL25zLmFkb2JlLmNvbS9waG90b3Nob3AvMS4wLyIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0RXZ0PSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VFdmVudCMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIDIyLjUgKE1hY2ludG9zaCkiIHhtcDpDcmVhdGVEYXRlPSIyMDIxLTEyLTI3VDE5OjI2OjU5LTA1OjAwIiB4bXA6TW9kaWZ5RGF0ZT0iMjAyMS0xMi0yN1QyMDowOToxMC0wNTowMCIgeG1wOk1ldGFkYXRhRGF0ZT0iMjAyMS0xMi0yN1QyMDowOToxMC0wNTowMCIgZGM6Zm9ybWF0PSJpbWFnZS9wbmciIHBob3Rvc2hvcDpDb2xvck1vZGU9IjMiIHBob3Rvc2hvcDpJQ0NQcm9maWxlPSJzUkdCIElFQzYxOTY2LTIuMSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDowMzQ0MjZjMS0yYjc5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"
                        height="30"
                        alt="Anchor Protocol"
                      ></img>
                    </Grid>
                    <Grid item>
                      <Typography component="h3" variant="h6">
                        Anchor Protocol
                      </Typography>
                      <Typography component="p">TERRA</Typography>
                    </Grid>
                  </Grid>
                </BorderedGrid>
                <BorderedGrid container xs={12}>
                  <Grid container xs={12}>
                    <Grid item xs={12}>
                      <Typography component="h2" variant="h5">
                        Token
                      </Typography>
                    </Grid>

                    <Grid
                      container
                      direction="row"
                      justifyContent="flex-start"
                      xs={12}
                      sx={{ my: 2 }}
                    >
                      <Grid item>
                        <img
                          src="https://app.aperture.finance/static/media/ust.321480c4.png"
                          height="30"
                          alt="UST"
                        ></img>
                      </Grid>
                      <Grid item>
                        <Typography component="h3" variant="h6">
                          UST
                        </Typography>
                      </Grid>
                    </Grid>
                  </Grid>
                  <StyledHr />
                  <Grid container xs={12}>
                    <Grid item xs={9}>
                      <StyledNumberFormat
                        value={value}
                        onChange={(e: any) => handleNumber(e.target.value)}
                        type="text"
                        thousandSeparator={true}
                        decimalScale={6}
                        placeholder={'0.00'}
                      />
                    </Grid>
                    <Grid item xs={3}>
                      <StyledButton
                        fullWidth
                        onClick={(e: any) => handleSetMax(e)}
                        variant="contained"
                        sx={{ mt: 3, mb: 2 }}
                      >
                        max
                      </StyledButton>
                    </Grid>
                  </Grid>
                </BorderedGrid>
                <Box>
                  {' '}
                  <Typography>estimate gas fee in UST:{' '}</Typography>
                  {fee && parseFloat(fee.toData().amount[0].amount) / 10 ** 6}
                  {!!amountError && (
                    <Typography color="error">
                      {' '}
                      **Amount invalid, please revise amount!
                    </Typography>
                  )}
                </Box>

                <StyledButton
                  onClick={proceed}
                  fullWidth
                  variant="contained"
                  sx={{ mt: 3, mb: 2 }}
                  disabled={
                    !!!connectedWallet?.availablePost ||
                    !!isLoading ||
                    !!txResult ||
                    !!txError ||
                    !!amountError
                  }
                >
                  {!!!isLoading && 'invest'}
                  {!!isLoading && <CircularProgress />}
                  {!!txResult && <CheckIcon />}
                  {!!txError || (!!amountError && <ErrorIcon />)}
                </StyledButton>
              </Grid>
              <Grid container xs={12}>
                {txResult && (
                  <>
                    {connectedWallet && txResult && (
                      <div>
                        <a
                          href={`https://finder.terra.money/${connectedWallet.network.chainID}/tx/${txResult.result.txhash}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Typography>
                            Open Tx Result in Terra Finder
                          </Typography>
                        </a>
                      </div>
                    )}
                  </>
                )}

                {txError && <Typography>Error: {txError}</Typography>}

                {(!!txResult || !!txError) && (
                  <button
                    onClick={() => {
                      setTxResult(null);
                      setTxError(null);
                    }}
                  >
                    Clear result
                  </button>
                )}

                {!connectedWallet && <p>Wallet not connected!</p>}

                {connectedWallet && !connectedWallet.availablePost && (
                  <p>This connection does not support post()</p>
                )}
              </Grid>
            </Box>
          </Box>
        </Container>
      </ThemeProvider>
    </div>
  );
}
