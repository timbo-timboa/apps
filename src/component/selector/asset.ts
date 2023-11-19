import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { range } from 'lit/directives/range.js';
import { map } from 'lit/directives/map.js';

import { Amount, Asset } from '@galacticcouncil/sdk';

import { baseStyles } from '../styles/base.css';
import { selectorStyles } from '../styles/selector.css';

import {
  formatAmount,
  humanizeAmount,
  multipleAmounts,
} from '../../utils/amount';
import { isAssetInAllowed, isAssetOutAllowed } from '../../utils/asset';

import { AssetSelector } from './types';

import '../id/asset';

@customElement('gc-select-asset')
export class SelectAsset extends LitElement {
  @property({ attribute: false }) assets: Asset[] = [];
  @property({ attribute: false }) assetsAlt: Asset[] = null;
  @property({ attribute: false }) pairs: Map<string, Asset[]> = new Map([]);
  @property({ attribute: false }) locations: Map<string, number> = new Map([]);
  @property({ attribute: false }) balances: Map<string, Amount> = new Map([]);
  @property({ attribute: false }) usdPrice: Map<string, Amount> = new Map([]);
  @property({ attribute: false }) selector: AssetSelector = null;
  @property({ type: Object }) assetIn: Asset = null;
  @property({ type: Object }) assetOut: Asset = null;
  @property({ type: Boolean }) switchAllowed = true;
  @property({ type: String }) query = '';

  static styles = [baseStyles, selectorStyles];

  private updateSearch(searchDetail: any) {
    this.query = searchDetail.value;
  }

  private getDollarPrice(asset: Asset, amount: string) {
    if (this.usdPrice.size == 0) {
      return null;
    }

    const usdPrice = this.usdPrice.get(asset.id);
    if (usdPrice == null) {
      return Number(amount).toFixed(2);
    }
    return multipleAmounts(amount, usdPrice).toFixed(2);
  }

  private getAssetBalance(asset: Asset) {
    const balance = this.balances.get(asset.id);
    const balanceFormated = balance
      ? formatAmount(balance.amount, balance.decimals)
      : null;
    const balanceUsd = balance
      ? this.getDollarPrice(asset, balanceFormated)
      : null;
    return {
      asset: asset,
      balance: balanceFormated,
      balanceUsd: balanceUsd,
    };
  }

  private filterAsset(query: string, asset: Asset) {
    const symbolEq = asset.symbol.toLowerCase().includes(query.toLowerCase());
    const nameEq = asset.name.toLowerCase().includes(query.toLowerCase());
    const isEq = symbolEq || nameEq;
    return isEq;
  }

  private filterAssets(query: string, assets: Asset[]) {
    return assets
      .filter((a) => this.filterAsset(query, a))
      .map((a) => this.getAssetBalance(a))
      .sort((a, b) => Number(b.balanceUsd) - Number(a.balanceUsd));
  }

  private filter(query: string) {
    if (!this.assetsAlt) {
      return this.filterAssets(query, this.assets);
    }

    const secondaryArr = this.assetsAlt.map(({ id }) => id);
    const secondarySet = new Set(secondaryArr);
    const assets = this.assets.filter((a) => !secondarySet.has(a.id));
    const selected = this[this.selector?.id];
    const inPrimary = assets.find((asset) => asset.symbol === selected?.symbol);

    if (inPrimary) {
      return this.filterAssets(query, assets);
    }
    return this.filterAssets(query, this.assetsAlt);
  }

  isDisabled(asset: Asset): boolean {
    const asAssetInAllowed = isAssetInAllowed(
      this.assets,
      this.pairs,
      asset.id,
    );
    const asAssetOutAllowed = isAssetOutAllowed(
      this.assets,
      this.pairs,
      asset.id,
    );

    if (this.selector?.id == 'assetIn') {
      return this.switchAllowed
        ? !asAssetInAllowed
        : this.assetOut.symbol == asset.symbol;
    } else if (this.selector?.id == 'assetOut') {
      return !asAssetOutAllowed;
    } else {
      return false;
    }
  }

  isSelected(asset: Asset): boolean {
    if (this.selector?.asset) {
      return this[this.selector.id].id === asset.id;
    }
    return false;
  }

  getSlot(asset: Asset): string {
    if (this.isSelected(asset)) {
      return 'selected';
    } else if (this.isDisabled(asset)) {
      return 'disabled';
    } else {
      return null;
    }
  }

  loadingTemplate() {
    return html`
      <div class="loading">
        <uigc-skeleton circle progress></uigc-skeleton>
        <span class="title">
          <uigc-skeleton
            progress
            rectangle
            width="40px"
            height="16px"
          ></uigc-skeleton>
          <uigc-skeleton
            progress
            rectangle
            width="50px"
            height="8px"
          ></uigc-skeleton>
        </span>
        <span class="grow"></span>
        <uigc-skeleton
          progress
          rectangle
          width="100px"
          height="16px"
        ></uigc-skeleton>
      </div>
    `;
  }

  render() {
    return html`
      <slot name="header"></slot>
      <uigc-search-bar
        class="search"
        placeholder="Search by name"
        @search-changed=${(e: CustomEvent) => this.updateSearch(e.detail)}
      ></uigc-search-bar>
      ${when(
        this.assets.length > 0,
        () => html` <uigc-asset-list>
          ${map(this.filter(this.query), ({ asset, balance, balanceUsd }) => {
            const icons = asset.icon.split('/');
            return html`
              <uigc-asset-list-item
                slot=${this.getSlot(asset)}
                ?selected=${this.isSelected(asset)}
                ?disabled=${this.isDisabled(asset)}
                .asset=${asset}
                .unit=${icons.length === 1 ? asset.symbol : null}
                .balance=${humanizeAmount(balance)}
                .balanceUsd=${humanizeAmount(balanceUsd)}
              >
                <gc-asset-id
                  slot="asset"
                  .showDesc=${true}
                  .asset=${asset}
                  .detail=${asset.name}
                  .locations=${this.locations}
                ></gc-asset-id>
              </uigc-asset-list-item>
            `;
          })}
        </uigc-asset-list>`,
        () =>
          html`
            <uigc-asset-list>
              ${map(range(3), (i) => this.loadingTemplate())}
            </uigc-asset-list>
          `,
      )}
    `;
  }
}
