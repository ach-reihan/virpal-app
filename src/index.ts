/**
 * VirPal App - AI Assistant with Azure Functions
 * Copyright (c) 2025 Achmad Reihan Alfaiz. All rights reserved.
 *
 * This file is part of VirPal App, a proprietary software application.
 *
 * PROPRIETARY AND CONFIDENTIAL
 *
 * This source code is the exclusive property of Achmad Reihan Alfaiz.
 * No part of this software may be reproduced, distributed, or transmitted
 * in any form or by any means, including photocopying, recording, or other
 * electronic or mechanical methods, without the prior written permission
 * of the copyright holder, except in the case of brief quotations embodied
 * in critical reviews and certain other noncommercial uses permitted by * copyright law.
 *
 * For licensing inquiries: reihan3000@gmail.com
 */

import { app } from '@azure/functions';

// Import functions to register them with the Azure Functions runtime
import './functions/chat-completion.js';
import './functions/get-secret.js';
import './functions/health.js';

app.setup({
  enableHttpStream: true,
});
